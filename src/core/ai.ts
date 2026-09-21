import { CLASSES } from '../data/units';
import { perform, validate, type Action } from './actions';
import { coverAgainst, expectedDamage } from './combat';
import { scaledMove } from './environment';
import { dist, distanceMap, hasLos, idx, reachable } from './grid';
import type { GameState, Pos, Team, Unit } from './types';

/**
 * Simple, replaceable AI. It only reads what its own team knows: `seenUnits[team]`, `visible[team]` and
 * `memory[team]` - the same fog rules the human plays under. Replace `planAction` to change behaviour.
 *
 * Per unit: reload if empty; with a visible target, step to the best cover tile that still has range + LOS and
 * shoot the highest expected-damage target; with no target, advance toward the last known enemy position, the
 * objective (once seen) or a search waypoint, and finish on overwatch.
 */
export function* aiTurn(s: GameState, team: Team): Generator<Action> {
  for (const u of s.units.filter((x) => x.team === team && x.alive)) {
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
  const holding = s.capture?.unit === u.id; // securing the objective: must not move
  const interact: Action = { type: 'interact', unit: u.id };
  if (ok(s, interact)) return interact;
  const reload: Action = { type: 'reload', unit: u.id };
  if (u.ammo === 0 && ok(s, reload)) return reload;

  const enemies = s.units.filter((e) => e.alive && e.team !== u.team && s.seenUnits[u.team].has(e.id));
  const move = scaledMove(s, CLASSES[u.cls].move);
  if (enemies.length) {
    const here = evaluate(s, u, enemies, u, 0);
    if (u.actions >= 2 && !holding) {
      // Room to move and still shoot: take the best cover tile that keeps range + LOS.
      let best = here;
      for (const [i, r] of reachable(s, u, move)) {
        const e = evaluate(s, u, enemies, { x: i % s.width, y: Math.floor(i / s.width) }, r.cost);
        if (e && (!best || e.score > best.score)) best = e;
      }
      if (best && (best.pos.x !== u.x || best.pos.y !== u.y)) return { type: 'move', unit: u.id, to: best.pos };
    }
    if (here) return { type: 'attack', unit: u.id, target: here.target.id };
    if (holding) return validate(s, { type: 'overwatch', unit: u.id }) === null ? { type: 'overwatch', unit: u.id } : null;
    const nearest = enemies.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
    return advance(s, u, nearest);
  }

  const goal = holding ? null : pickGoal(s, u);
  if (u.actions >= 2 || u.ammo === 0) {
    const mv = goal && advance(s, u, goal);
    if (mv) return mv;
  }
  const ow: Action = { type: 'overwatch', unit: u.id };
  if (ok(s, ow)) return ow;
  return goal ? advance(s, u, goal) : null;
}

/** Score a tile: cover facing the target it would shoot dominates, then expected damage, then a short walk. */
function evaluate(s: GameState, u: Unit, enemies: Unit[], pos: Pos, cost: number) {
  const w = CLASSES[u.cls].weapon;
  let best: { pos: Pos; target: Unit; score: number } | null = null;
  for (const e of enemies) {
    if (dist(pos, e) > w.range || !hasLos(s, pos, e)) continue;
    const exp = expectedDamage(s, u, e, pos);
    const score = coverAgainst(s, pos, e).penalty * 100 + exp * 10 - cost;
    if (!best || exp > expectedDamage(s, u, best.target, pos)) best = { pos, target: e, score };
  }
  return best;
}

/** Move to the reachable tile closest (by walking distance) to the goal, if that is closer than where we stand. */
function advance(s: GameState, u: Unit, goal: Pos): Action | null {
  const d = distanceMap(s, goal);
  const here = d[idx(s, u.x, u.y)];
  let best: { pos: Pos; d: number; cost: number } | null = null;
  for (const [i, r] of reachable(s, u, scaledMove(s, CLASSES[u.cls].move))) {
    if (d[i] < 0) continue;
    if (!best || d[i] < best.d || (d[i] === best.d && r.cost < best.cost)) best = { pos: { x: i % s.width, y: Math.floor(i / s.width) }, d: d[i], cost: r.cost };
  }
  if (!best || (here >= 0 && best.d >= here)) return null;
  return { type: 'move', unit: u.id, to: best.pos };
}

/** No target in sight: chase the nearest ghost, else the objective if it has been seen, else a search waypoint. */
function pickGoal(s: GameState, u: Unit): Pos | null {
  const mem = s.memory[u.team];
  const ghosts = Object.values(mem.lastSeen);
  if (ghosts.length) return ghosts.reduce((a, b) => (dist(u, a) <= dist(u, b) ? a : b));
  if (mem.objectiveSeen && s.objective) return s.objective;
  const points = s.map.searchPoints[u.team];
  if (!points.length) return null;
  const rank = s.units.filter((x) => x.team === u.team && x.alive).indexOf(u);
  const [x, y] = points[(mem.searchIndex + rank) % points.length];
  if (dist(u, { x, y }) <= 2) mem.searchIndex++; // waypoint reached, team moves on to the next one
  return { x, y };
}
