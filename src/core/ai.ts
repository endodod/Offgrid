import { CLASSES } from '../data/units';
import { AI_PROFILES, type AiProfileDef } from '../data/aiProfiles';
import { perform, validate, type Action } from './actions';
import { coverAgainst, expectedDamage } from './combat';
import { effectiveMove, effectiveVision } from './environment';
import { emit } from './state';
import { cheb, dist, distanceMap, hasLos, idx, reachable } from './grid';
import { objectiveGoalPositions } from './objectives';
import { rollPercent } from './rng';
import type { GameState, Pos, Team, Unit } from './types';

/**
 * Simple, replaceable AI, parametrized by a per-team AiProfile (`data/aiProfiles.ts`, `GameState.aiProfiles`).
 * It only reads what its own team knows: `seenUnits[team]`, `visible[team]` and `memory[team]` - the same fog
 * rules the human plays under. Replace `planAction` to change behaviour.
 *
 * The 'standard' profile (reactionChance 1, habitat 'patrol', no retreat) reproduces the original fixed
 * behaviour exactly: reload if empty, with a visible target step to the best cover tile that still has range +
 * LOS and shoot the highest expected-damage target, with no target advance toward the last known enemy
 * position, the objective (once seen) or a search waypoint, and finish on overwatch. Other profiles vary
 * reaction quality (hesitation), self-preservation (retreat) and habitat (patrol/camper/ambush idle behaviour).
 */
export function* aiTurn(s: GameState, team: Team): Generator<Action> {
  for (const u of s.units.filter((x) => x.team === team && x.alive && !x.downed)) {
    for (let guard = 0; guard < 6 && u.alive && !s.winner; guard++) {
      const a = planAction(s, u);
      if (!a || !perform(s, a).ok) break;
      yield a;
    }
    if (s.winner) return;
  }
  if (!s.winner && perform(s, { type: 'endTurn' }).ok) yield { type: 'endTurn' };
}

export function runAiTurn(s: GameState, team: Team) {
  for (const _ of aiTurn(s, team)) void _;
}

const ok = (s: GameState, a: Action) => validate(s, a) === null;

export function planAction(s: GameState, u: Unit): Action | null {
  if (u.actions <= 0 || u.overwatch) return null;
  if (u.dormant && !wakePods(s, u)) return null; // 10j: asleep until its pod is alerted
  const holding = s.capture?.unit === u.id; // securing the objective: must not move
  const interact: Action = { type: 'interact', unit: u.id };
  if (ok(s, interact)) return interact;
  const reload: Action = { type: 'reload', unit: u.id };
  if (u.ammo === 0 && ok(s, reload)) return reload;
  const sabotage = objectiveSwitch(s, u);
  if (sabotage) return sabotage;

  // An already-adjacent downed ally costs nothing extra to revive (no repositioning), so it comes before
  // deciding whether to fight - triage over a marginal shot, even mid-firefight.
  if (s.options.aiRevive !== false) {
    const adjacentDowned = s.units.find((a) => a.team === u.team && a.alive && a.downed && cheb(u, a) <= 1);
    if (adjacentDowned) {
      const revive: Action = { type: 'revive', unit: u.id, target: adjacentDowned.id };
      if (ok(s, revive)) return revive;
    }
  }

  const profile = AI_PROFILES[u.aiProfile ?? s.aiProfiles[u.team]];
  const enemies = s.units.filter((e) => e.alive && e.team !== u.team && s.seenUnits[u.team].has(e.id));
  const move = effectiveMove(s, u);

  // Difficulty: a unit that fails its reaction roll doesn't act with full competence this decision - it holds
  // position/overwatch instead of taking its best move or shot. reactionChance 1 (most profiles) never rolls,
  // so this is a no-op for the regression-safe default. Goes through the same seeded roll as combat (rollPercent)
  // so it stays deterministic and is overridable by tests the same way.
  const reacts = profile.reactionChance >= 1 || rollPercent(s) < profile.reactionChance * 100;

  if (enemies.length) {
    if (!reacts) return ok(s, { type: 'overwatch', unit: u.id }) ? { type: 'overwatch', unit: u.id } : null;
    if (profile.retreatBelowHp !== undefined && !holding && u.hp / CLASSES[u.cls].hp < profile.retreatBelowHp) {
      const r = retreat(s, u, enemies, move);
      if (r) return r;
    }
    const here = evaluate(s, u, enemies, u, 0);
    // Rush (16): the objective is the point. With a move to spare, step to the tile closest to it that still
    // has a shot; if nothing on the way has one, shoot from here, or just keep walking toward it.
    const objective = profile.focus === 'objective' && !holding ? nearestOf(u, objectiveGoalPositions(s, u.team)) : null;
    if (objective && u.actions >= 2) {
      const d = distanceMap(s, objective);
      let best: { pos: Pos; d: number } | null = null;
      for (const [i, r] of reachable(s, u, move)) {
        const pos = { x: i % s.width, y: Math.floor(i / s.width) };
        if (d[i] < 0 || !evaluate(s, u, enemies, pos, r.cost)) continue;
        if (!best || d[i] < best.d) best = { pos, d: d[i] };
      }
      if (best && best.d < d[idx(s, u.x, u.y)]) return { type: 'move', unit: u.id, to: best.pos };
    }
    // Camper: reluctant to leave a position it already has - only reposition when it has no shot at all.
    // Hold (16): repositions, but only within its leash.
    if (u.actions >= 2 && !holding && !objective && profile.habitat !== 'camper') {
      let best = here;
      const leash = profile.habitat === 'hold' ? profile.leash ?? 2 : Infinity;
      for (const [i, r] of reachable(s, u, move)) {
        if (r.cost > leash) continue;
        const e = evaluate(s, u, enemies, { x: i % s.width, y: Math.floor(i / s.width) }, r.cost);
        if (e && (!best || e.score > best.score)) best = e;
      }
      if (best && (best.pos.x !== u.x || best.pos.y !== u.y)) return { type: 'move', unit: u.id, to: best.pos };
    }
    if (here && u.ammo > 0) return { type: 'attack', unit: u.id, target: here.target.id }; // ammo (4): a real attack needs ammo, not just a good angle
    if (holding || profile.habitat === 'hold') return validate(s, { type: 'overwatch', unit: u.id }) === null ? { type: 'overwatch', unit: u.id } : null;
    if (objective) { const mv = advance(s, u, objective); if (mv) return mv; }
    const nearest = enemies.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
    return advance(s, u, nearest);
  }

  // No visible enemy: chase a downed ally that isn't adjacent yet (the adjacent case is handled above,
  // before combat is even considered), before falling back to habitat-gated search behaviour.
  if (s.options.aiRevive !== false) {
    const downed = s.units.filter((a) => a.team === u.team && a.alive && a.downed);
    if (downed.length) {
      const target = downed.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
      const revive: Action = { type: 'revive', unit: u.id, target: target.id };
      if (ok(s, revive)) return revive;
      if (!holding) return advance(s, u, target);
    }
  }

  // Ammo (4): truly out (nothing left to reload with either) - head for the nearest *visible* ammo pickup
  // instead of idling per habitat. Refilling beats patrolling on an empty gun.
  if (!holding && u.ammo === 0 && u.reserve === 0) {
    const ammoHere = s.pickups.filter((p) => p.type === 'ammo' && s.visible[u.team][idx(s, p.x, p.y)]);
    const nearestPickup = nearestOf(u, ammoHere);
    if (nearestPickup) {
      const mv = advance(s, u, nearestPickup);
      if (mv) return mv;
    }
  }

  const goal = holding || !reacts ? null : pickGoal(s, u, profile);
  if (u.actions >= 2 || u.ammo === 0) {
    const mv = goal && advance(s, u, goal);
    if (mv) return mv;
  }
  // Last action and a door in the way: opening it beats standing on overwatch in front of it (10j).
  const door = goal && aiOpensDoors(s) ? doorOnRoute(s, u, distanceMap(s, goal, true)) : null;
  if (door) return door;
  const ow: Action = { type: 'overwatch', unit: u.id };
  if (ok(s, ow)) return ow;
  return goal ? advance(s, u, goal) : null;
}

/**
 * 10j: whether `u`'s pod is alerted, waking all of it if so. A pod wakes when any member has been hurt, or has
 * one of the other team's units in its own sight - its own vision range and line of sight, not just "somebody
 * on the team can see them": a pod asleep across the map doesn't hear about a fight it can't see.
 */
export function wakePods(s: GameState, u: Unit): boolean {
  if (!u.dormant) return true;
  const pod = s.units.filter((m) => m.team === u.team && m.pod === u.pod && m.alive);
  const foes = s.units.filter((f) => f.alive && f.team !== u.team && s.seenUnits[u.team].has(f.id));
  const alerted = pod.some((m) => m.dmgTaken > 0 || m.downed
    || foes.some((f) => dist(m, f) <= effectiveVision(s, m) && hasLos(s, m, f)));
  if (!alerted) return false;
  for (const m of pod) m.dormant = false;
  emit(s, { t: 'alert', units: pod.map((m) => m.id) }, pod);
  return true;
}

/**
 * Self-preservation (a profile's retreatBelowHp), reworked in 10j. Running "further away" alone lost more fights
 * than it saved (0c's finding: the enemy just follows, and the retreat cost a shot). So a retreat now goes for
 * real safety, in this order: out of every visible enemy's line of sight, then the best cover against the
 * nearest one, then distance. It only moves if that is strictly safer than staying put.
 */
function retreat(s: GameState, u: Unit, enemies: Unit[], move: number): Action | null {
  const nearest = enemies.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
  const safety = (pos: Pos) =>
    (enemies.every((e) => !hasLos(s, e, pos)) ? 1000 : 0) + coverAgainst(s, pos, nearest).penalty * 4 + Math.min(dist(pos, nearest), 20);
  const here = safety(u);
  let best: { pos: Pos; score: number } | null = null;
  for (const [i, r] of reachable(s, u, move)) {
    const pos = { x: i % s.width, y: Math.floor(i / s.width) };
    const score = safety(pos) - r.cost * 0.1;
    if (!best || score > best.score) best = { pos, score };
  }
  if (!best || best.score <= here || (best.pos.x === u.x && best.pos.y === u.y)) return null;
  return { type: 'move', unit: u.id, to: best.pos };
}

/**
 * Score a tile: cover facing the target it would shoot dominates, then expected damage, then a short walk.
 * A downed enemy is a guaranteed kill (see combat.ts's finishing shot), so it always outscores a normal target.
 */
function evaluate(s: GameState, u: Unit, enemies: Unit[], pos: Pos, cost: number) {
  const w = CLASSES[u.cls].weapon;
  const value = (e: Unit) => (e.downed ? Number.MAX_SAFE_INTEGER : expectedDamage(s, u, e, pos));
  let best: { pos: Pos; target: Unit; score: number } | null = null;
  for (const e of enemies) {
    if (dist(pos, e) > w.range || !hasLos(s, pos, e)) continue;
    const exp = value(e);
    const score = coverAgainst(s, pos, e).penalty * 100 + Math.min(exp, 1000) * 10 - cost;
    if (!best || exp > value(best.target)) best = { pos, target: e, score };
  }
  return best;
}

/**
 * Move to the reachable tile closest (by walking distance) to the goal, if that is closer than where we stand.
 * 10j: the AI can also open doors. Distances are measured as if closed doors were open, so a door on the way
 * is part of the route; standing next to one that leads closer, the unit opens it instead of walking round.
 */
function advance(s: GameState, u: Unit, goal: Pos): Action | null {
  const doors = aiOpensDoors(s);
  const d = distanceMap(s, goal, doors);
  const here = d[idx(s, u.x, u.y)];
  const open = doors ? doorOnRoute(s, u, d) : null;
  if (open) return open;
  let best: { pos: Pos; d: number; cost: number } | null = null;
  for (const [i, r] of reachable(s, u, effectiveMove(s, u))) {
    if (d[i] < 0) continue;
    if (!best || d[i] < best.d || (d[i] === best.d && r.cost < best.cost)) best = { pos: { x: i % s.width, y: Math.floor(i / s.width) }, d: d[i], cost: r.cost };
  }
  if (!best || (here >= 0 && best.d >= here)) return null;
  return { type: 'move', unit: u.id, to: best.pos };
}

/** An adjacent closed door that leads closer to the goal `d` was measured from, as an interact action (10j). */
function doorOnRoute(s: GameState, u: Unit, d: Int16Array): Action | null {
  const here = d[idx(s, u.x, u.y)];
  if (here <= 0) return null;
  for (const it of s.interactables) {
    if (it.type !== 'door' || it.active || cheb(u, it) > 1) continue;
    const through = d[idx(s, it.x, it.y)];
    const open: Action = { type: 'interact', unit: u.id, target: it.id };
    if (through >= 0 && through < here && ok(s, open)) return open;
  }
  return null;
}

/**
 * 10j: a 'sabotage' objective's switch next to `u`, not yet thrown, as an interact action - for a team that may
 * win by the objective (GameOptions.objectiveCapture). The AI used to walk up to one and then stand there:
 * the plain `interact` above only works the 'hold' terminal.
 */
function objectiveSwitch(s: GameState, u: Unit): Action | null {
  const capture = s.options.objectiveCapture;
  if (s.objectiveDef?.type !== 'sabotage' || capture === 'none' || (capture === 'player' && u.team !== 'player')) return null;
  for (const it of s.interactables) {
    if (!s.objectiveDef.interactableIds.includes(it.id) || it.active || cheb(u, it) > 1) continue;
    const a: Action = { type: 'interact', unit: u.id, target: it.id };
    if (ok(s, a)) return a;
  }
  return null;
}

/** Whether AI units may open doors here: on unless the game options or the map turn it off (10j). */
const aiOpensDoors = (s: GameState): boolean => s.options.aiDoors !== false && s.map.aiOpensDoors !== false;

const nearestOf = (u: Unit, points: Pos[]): Pos | null => (points.length ? points.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b)) : null);

/**
 * No target in sight: habitat decides how (or whether) the unit looks for one.
 * - patrol: chase the nearest ghost, else a seen objective goal (3), else a search waypoint (default).
 * - camper: holds a position once it has one - defends a seen objective goal, otherwise stays put.
 * - ambush: stays completely still and hidden until it has a visible target; then it fights like a patrol.
 * prioritizeObjective (patrol only) swaps the first two: heading for a seen objective goal beats chasing a
 * ghost - finishing the mission over finishing a fight it doesn't have to (the 'friendly' auto-run profile).
 */
function pickGoal(s: GameState, u: Unit, profile: AiProfileDef): Pos | null {
  if (profile.habitat === 'ambush' || profile.habitat === 'hold') return null;
  const mem = s.memory[u.team];
  const goal = () => nearestOf(u, objectiveGoalPositions(s, u.team));
  if (profile.habitat === 'camper') return goal();
  if (profile.prioritizeObjective || profile.focus === 'objective') { const g = goal(); if (g) return g; }
  if (profile.focus === 'explore') {
    // Loot it can see, or a chest it has seen and not opened yet; then ground nobody has looked at; then the
    // waypoints; a fight only after that.
    const loot = [
      ...s.pickups.filter((p) => s.visible[u.team][idx(s, p.x, p.y)]),
      ...s.interactables.filter((it) => it.type === 'chest' && it.id in mem.doors && !mem.doors[it.id]),
    ];
    const l = nearestOf(u, loot);
    if (l) return l;
    const f = frontier(s, u);
    if (f) return f;
    const w = waypoint(s, u);
    if (w) return w;
  }
  const ghosts = Object.values(mem.lastSeen);
  if (ghosts.length) return ghosts.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
  const g = goal();
  if (g) return g;
  // The authored waypoints first; once the team has been round them all, whatever it hasn't seen yet (10j) -
  // otherwise a pod asleep off the waypoint route, or an objective nowhere near one, is never found.
  const points = s.map.searchPoints[u.team];
  if (!points.length) return null; // no search route authored: nothing to go looking along (small test maps)
  if (mem.searchIndex < points.length) return waypoint(s, u);
  return frontier(s, u) ?? waypoint(s, u);
}

/** 10j: the nearest tile (walking, doors counted as openable) this team has never had in view, or null. */
function frontier(s: GameState, u: Unit): Pos | null {
  const explored = s.memory[u.team].explored;
  if (!explored) return null;
  const d = distanceMap(s, u, aiOpensDoors(s));
  let best = -1;
  for (let i = 0; i < d.length; i++) {
    if (d[i] <= 0 || explored[i]) continue;
    if (best < 0 || d[i] < d[best]) best = i;
  }
  return best < 0 ? null : { x: best % s.width, y: Math.floor(best / s.width) };
}

/** The team's next search waypoint for this unit (each unit is offset along the list, so they spread out). */
function waypoint(s: GameState, u: Unit): Pos | null {
  const mem = s.memory[u.team];
  const points = s.map.searchPoints[u.team];
  if (!points.length) return null;
  const rank = s.units.filter((x) => x.team === u.team && x.alive).indexOf(u);
  const [x, y] = points[(mem.searchIndex + rank) % points.length];
  if (dist(u, { x, y }) <= 2) mem.searchIndex++; // waypoint reached, team moves on to the next one
  return { x, y };
}
