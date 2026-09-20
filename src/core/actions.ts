import { CLASSES } from '../data/units';
import { GADGETS } from '../data/gadgets';
import { RULES } from '../data/rules';
import { applyDamage, coverAt, fireWeapon, targetBlock } from './combat';
import { cheb, dist, findPath, idx, inBounds, unitAt } from './grid';
import { beginCapture, checkCapture, declareWinner, emit, endTurn } from './state';
import { refreshVision } from './vision';
import type { GameEvent, GameState, Pos, Unit } from './types';

export type Action =
  | { type: 'move'; unit: number; to: Pos }
  | { type: 'attack'; unit: number; target: number }
  | { type: 'reload'; unit: number }
  | { type: 'gadget'; unit: number; target?: Pos; rotation?: number } // rotation: 0..3 quarter turns, cover gadget only
  | { type: 'overwatch'; unit: number }
  | { type: 'aid'; unit: number; target: number }
  | { type: 'interact'; unit: number }
  | { type: 'endTurn' };

export type Result = { ok: true; events: GameEvent[] } | { ok: false; error: string; events: [] };

const unitById = (s: GameState, id: number) => s.units.find((u) => u.id === id);
const hasActions = (u: Unit) => (u.actions > 0 ? null : 'No actions left');

/** Tiles a move action can cover right now: the Move stat plus any pending adrenaline bonus. */
export const moveRange = (u: Unit) => CLASSES[u.cls].move + u.moveBonus;

/** Why the unit cannot use its gadget right now (ignoring the target), or null. */
export function gadgetBlock(u: Unit): string | null {
  if (!u.gadget) return 'No gadget';
  if (u.gadget.uses <= 0) return 'No uses left';
  if (u.gadget.id === 'adrenaline' && u.moveBonus > 0) return 'Adrenaline already active';
  if (u.gadget.cooldown > 0) return `Cooling down (${u.gadget.cooldown} turn${u.gadget.cooldown > 1 ? 's' : ''})`;
  return hasActions(u);
}

export function gadgetTargetBlock(s: GameState, u: Unit, target?: Pos): string | null {
  const def = GADGETS[u.gadget!.id];
  if (def.target === 'none') return null;
  if (!target || !inBounds(s, target.x, target.y)) return 'Pick a target tile';
  if (def.target !== 'any' && !s.visible[u.team][idx(s, target.x, target.y)]) return 'Target tile not visible';
  if (def.range !== undefined && dist(u, target) > def.range) return 'Out of range';
  if (def.target === 'ally') {
    const t = unitAt(s, target.x, target.y);
    if (!t || t.team !== u.team) return 'Pick a friendly unit';
    if (t.hp >= CLASSES[t.cls].hp) return 'Already at full HP';
  }
  if (u.gadget!.id === 'cover') {
    const i = idx(s, target.x, target.y);
    if (s.terrain[i] === 'wall') return 'Cannot build on a wall';
    if (unitAt(s, target.x, target.y)) return 'Tile occupied';
    if (s.objective && s.objective.x === target.x && s.objective.y === target.y) return 'Tile occupied';
    if (s.cover[i] === 'high') return 'Already high cover';
  }
  return null;
}

export function aidBlock(u: Unit, target?: Unit): string | null {
  if (hasActions(u)) return hasActions(u);
  if (u.medkits <= 0) return 'No medkits';
  if (!target) return null;
  if (!target.alive || target.team !== u.team) return 'Not an ally';
  if (cheb(u, target) > 1) return 'Target not adjacent';
  if (target.hp >= CLASSES[target.cls].hp) return 'Already at full HP';
  return null;
}

export function interactBlock(s: GameState, u: Unit): string | null {
  if (hasActions(u)) return hasActions(u);
  if (!s.objective) return 'No objective';
  if (cheb(u, s.objective) > 1) return 'Objective not adjacent';
  if (s.capture) return s.capture.unit === u.id ? 'Already securing the objective' : 'Objective is already being secured';
  const capture = s.options.objectiveCapture;
  if (capture === 'none') return 'Objective capture is disabled';
  if (capture === 'player' && u.team === 'enemy') return 'Enemy cannot capture';
  return null;
}

/** Returns an error message, or null if the action is legal. */
export function validate(s: GameState, a: Action): string | null {
  if (s.winner) return 'The battle is over';
  if (a.type === 'endTurn') return null;
  const u = unitById(s, a.unit);
  if (!u || !u.alive) return 'No such unit';
  if (u.team !== s.phase) return "Not this team's phase";
  switch (a.type) {
    case 'move':
      if (u.actions <= 0) return 'No actions left';
      return findPath(s, u, a.to, moveRange(u)) ? null : 'Cannot reach that tile';
    case 'attack': {
      const t = unitById(s, a.target);
      if (hasActions(u)) return hasActions(u);
      if (u.overwatch) return 'Weapon reserved for overwatch';
      if (u.ammo <= 0) return 'Out of ammo';
      return t ? targetBlock(s, u, t) : 'Invalid target';
    }
    case 'reload':
      if (hasActions(u)) return hasActions(u);
      return u.ammo >= CLASSES[u.cls].weapon.magazine ? 'Magazine full' : null;
    case 'overwatch':
      if (hasActions(u)) return hasActions(u);
      if (u.ammo <= 0) return 'Out of ammo';
      return u.overwatch ? 'Already on overwatch' : null;
    case 'aid':
      return aidBlock(u, unitById(s, a.target));
    case 'interact':
      return interactBlock(s, u);
    case 'gadget':
      return gadgetBlock(u) ?? gadgetTargetBlock(s, u, a.target);
  }
}

export function perform(s: GameState, a: Action): Result {
  const error = validate(s, a);
  if (error) return { ok: false, error, events: [] };
  const start = s.events.length;
  if (a.type === 'endTurn') {
    endTurn(s);
    return { ok: true, events: s.events.slice(start) };
  }
  const u = unitById(s, a.unit)!;
  switch (a.type) {
    case 'move': doMove(s, u, a.to); break;
    case 'attack': {
      const t = unitById(s, a.target)!;
      u.actions--;
      u.ammo--; // one ammo per attack action, even for a burst
      fireWeapon(s, u, t, false);
      break;
    }
    case 'reload':
      u.actions--;
      u.ammo = CLASSES[u.cls].weapon.magazine;
      emit(s, { t: 'reload', unit: u.id }, [u]);
      break;
    case 'overwatch':
      u.actions--;
      u.overwatch = true;
      emit(s, { t: 'overwatch', unit: u.id }, [u]);
      break;
    case 'aid': {
      const t = unitById(s, a.target)!;
      u.actions--;
      u.medkits--;
      const amount = Math.min(RULES.medkitHeal, CLASSES[t.cls].hp - t.hp);
      t.hp += amount;
      emit(s, { t: 'heal', unit: u.id, target: t.id, amount, at: { x: t.x, y: t.y } }, [u, t]);
      break;
    }
    case 'interact':
      u.actions--;
      emit(s, { t: 'objective', unit: u.id }, [u]);
      beginCapture(s, u); // now it has to hold still; the win comes when the rounds run out
      break;
    case 'gadget': doGadget(s, u, a.target, a.rotation); break;
  }
  if (a.type !== 'move') {
    const revealed = expose(s, u); // acting (anything but moving) from a bush gives the position away
    refreshVision(s);
    if (revealed) emit(s, { t: 'exposed', unit: u.id }, [u]);
    triggerOverwatch(s, u);
  }
  checkCapture(s);
  checkWin(s);
  return { ok: true, events: s.events.slice(start) };
}

/** Marks a unit standing in a bush as exposed; returns true if that is news. */
function expose(s: GameState, u: Unit): boolean {
  if (!u.alive || u.exposed || s.terrain[idx(s, u.x, u.y)] !== 'bush') return false;
  u.exposed = true;
  return true;
}

function doMove(s: GameState, u: Unit, to: Pos) {
  const path = findPath(s, u, to, moveRange(u))!;
  u.moveBonus = 0; // adrenaline boosts one move, however far it goes
  u.actions--;
  const ev = emit(s, { t: 'move', unit: u.id, from: { x: u.x, y: u.y }, to }, false);
  const from = { x: u.x, y: u.y };
  // Walk step by step so overwatchers can react mid-path; a dead mover stops.
  for (const p of path) {
    u.x = p.x;
    u.y = p.y;
    refreshVision(s);
    triggerOverwatch(s, u);
    if (!u.alive) break;
  }
  ev.seen = (u.team === 'player' || s.seenUnits.player.has(u.id) || s.visible.player[idx(s, from.x, from.y)] === 1);
}

/** Overwatch: each waiting enemy of `actor` fires once if the actor is in range, in LOS and visible to it. */
function triggerOverwatch(s: GameState, actor: Unit) {
  for (const o of s.units) {
    if (!actor.alive) return;
    if (!o.alive || !o.overwatch || o.team === actor.team || o.ammo <= 0) continue;
    if (targetBlock(s, o, actor)) continue;
    o.overwatch = false;
    o.ammo--;
    fireWeapon(s, o, actor, true);
    const revealed = expose(s, o); // a reaction shot from a bush also gives the watcher away
    refreshVision(s);
    if (revealed) emit(s, { t: 'exposed', unit: o.id }, [o]);
  }
}

function doGadget(s: GameState, u: Unit, target?: Pos, rotation = 0) {
  const g = u.gadget!;
  const def = GADGETS[g.id];
  u.actions--;
  g.uses--;
  g.cooldown = RULES.gadgetCooldownTurns + 1; // used on turn N -> ready again on turn N+3 (ticks at each own phase start)
  emit(s, { t: 'gadget', unit: u.id, gadget: g.id, target }, [u]);
  if (g.id === 'adrenaline') {
    u.moveBonus = def.moveBonus!;
    u.actions += def.actionsRestored!; // paid 1 above, so the net gain is actionsRestored - 1; can exceed the usual 2 per turn
  }
  else if (g.id === 'scan') s.scans.push({ team: u.team, x: target!.x, y: target!.y, radius: def.radius!, turnsLeft: def.durationTurns! });
  else if (g.id === 'cover') setCover(s, target!, coverAt(s, target!.x, target!.y) === 'low' ? 'high' : 'low', rotation);
  else if (g.id === 'medkit') {
    const t = unitAt(s, target!.x, target!.y)!;
    const amount = CLASSES[t.cls].hp - t.hp;
    t.hp += amount;
    emit(s, { t: 'heal', unit: u.id, target: t.id, amount, at: { x: t.x, y: t.y } }, [u, t]);
  }
  else if (g.id === 'grenade') blast(s, u, target!, def.radius!, def.damage!);
}

function setCover(s: GameState, at: Pos, to: 'low' | 'high' | null, rotation?: number) {
  const from = coverAt(s, at.x, at.y);
  s.cover[idx(s, at.x, at.y)] = to;
  if (rotation !== undefined) s.coverRot[idx(s, at.x, at.y)] = ((rotation % 4) + 4) % 4; // an upgrade or grenade keeps the old rotation
  emit(s, { t: 'cover', at, from, to }, [at]);
}

/** Grenade: flat damage (ignores armor) to every unit in the blast square; high cover -> low, low cover destroyed. */
function blast(s: GameState, thrower: Unit, center: Pos, radius: number, damage: number) {
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (!inBounds(s, x, y)) continue;
      const c = coverAt(s, x, y);
      if (c) setCover(s, { x, y }, c === 'high' ? 'low' : null);
      const victim = unitAt(s, x, y);
      if (!victim) continue;
      emit(s, { t: 'damage', target: victim.id, amount: damage, source: 'grenade', at: { x, y } }, [victim]);
      applyDamage(s, victim, damage, thrower);
    }
  }
}

function checkWin(s: GameState) {
  if (s.winner) return;
  const alive = (team: string) => s.units.some((u) => u.alive && u.team === team);
  if (!alive('player') && !alive('enemy')) declareWinner(s, 'draw');
  else if (!alive('player')) declareWinner(s, 'enemy');
  else if (!alive('enemy')) declareWinner(s, 'player');
}
