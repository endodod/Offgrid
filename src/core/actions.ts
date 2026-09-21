import { CLASSES } from '../data/units';
import { GADGETS } from '../data/gadgets';
import { RULES } from '../data/rules';
import { applyDamage, coverAt, fireWeapon, targetBlock } from './combat';
import { scaledMove } from './environment';
import { cheb, dist, findPath, idx, inBounds, unitAt } from './grid';
import { beginCapture, checkCapture, checkWin, emit, endTurn } from './state';
import { refreshVision } from './vision';
import type { GameEvent, GameState, Pos, Unit } from './types';

export type Action =
  | { type: 'move'; unit: number; to: Pos }
  | { type: 'attack'; unit: number; target: number }
  | { type: 'reload'; unit: number }
  | { type: 'gadget'; unit: number; target?: Pos; rotation?: number } // rotation: 0..3 quarter turns, cover gadget only
  | { type: 'overwatch'; unit: number }
  | { type: 'aid'; unit: number; target: number }
  | { type: 'revive'; unit: number; target: number }
  | { type: 'interact'; unit: number; target?: number } // target: an interactable id (2); omitted = the objective
  | { type: 'endTurn' };

export type Result = { ok: true; events: GameEvent[] } | { ok: false; error: string; events: [] };

const unitById = (s: GameState, id: number) => s.units.find((u) => u.id === id);
const hasActions = (u: Unit) => (u.actions > 0 ? null : 'No actions left');

/** Tiles a move action can cover right now: the Move stat (scaled by time of day/weather) plus any pending adrenaline bonus. */
export const moveRange = (s: GameState, u: Unit) => scaledMove(s, CLASSES[u.cls].move) + u.moveBonus;

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
    if (t.downed) return 'Downed - use Revive instead';
    if (t.hp >= CLASSES[t.cls].hp) return 'Already at full HP';
  }
  if (u.gadget!.id === 'cover') {
    const i = idx(s, target.x, target.y);
    if (s.terrain[i] === 'wall') return 'Cannot build on a wall';
    if (unitAt(s, target.x, target.y)) return 'Tile occupied';
    if (s.objectiveDef?.type === 'hold' && s.objective && s.objective.x === target.x && s.objective.y === target.y) return 'Tile occupied';
    if (s.cover[i] === 'high') return 'Already high cover';
  }
  return null;
}

export function aidBlock(u: Unit, target?: Unit): string | null {
  if (hasActions(u)) return hasActions(u);
  if (u.medkits <= 0) return 'No medkits';
  if (!target) return null;
  if (!target.alive || target.team !== u.team) return 'Not an ally';
  if (target.downed) return 'Downed - use Revive instead';
  if (cheb(u, target) > 1) return 'Target not adjacent';
  if (target.hp >= CLASSES[target.cls].hp) return 'Already at full HP';
  return null;
}

/** Why `u` cannot revive `target` right now (ignoring the target if omitted), or null. */
export function reviveBlock(u: Unit, target?: Unit): string | null {
  if (hasActions(u)) return hasActions(u);
  if (u.medkits <= 0) return 'No medkits';
  if (!target) return null;
  if (!target.alive || !target.downed || target.team !== u.team) return 'Not a downed ally';
  if (cheb(u, target) > 1) return 'Target not adjacent';
  return null;
}

export function interactBlock(s: GameState, u: Unit): string | null {
  if (hasActions(u)) return hasActions(u);
  if (s.objectiveDef?.type !== 'hold' || !s.objective) return 'No objective';
  if (cheb(u, s.objective) > 1) return 'Objective not adjacent';
  if (s.capture) return s.capture.unit === u.id ? 'Already securing the objective' : 'Objective is already being secured';
  const capture = s.options.objectiveCapture;
  if (capture === 'none') return 'Objective capture is disabled';
  if (capture === 'player' && u.team === 'enemy') return 'Enemy cannot capture';
  return null;
}

/** Why `u` cannot interact with interactable `targetId` (a door or switch, 2) right now, or null. */
export function interactableBlock(s: GameState, u: Unit, targetId: number): string | null {
  if (hasActions(u)) return hasActions(u);
  const it = s.interactables.find((i) => i.id === targetId);
  if (!it) return 'No such interactable';
  if (cheb(u, it) > 1) return 'Not adjacent';
  return null;
}

/** Returns an error message, or null if the action is legal. */
export function validate(s: GameState, a: Action): string | null {
  if (s.winner) return 'The battle is over';
  if (a.type === 'endTurn') return null;
  const u = unitById(s, a.unit);
  if (!u || !u.alive) return 'No such unit';
  if (u.downed) return 'Downed - cannot act';
  if (u.team !== s.phase) return "Not this team's phase";
  switch (a.type) {
    case 'move':
      if (u.actions <= 0) return 'No actions left';
      return findPath(s, u, a.to, moveRange(s, u)) ? null : 'Cannot reach that tile';
    case 'attack': {
      const t = unitById(s, a.target);
      if (hasActions(u)) return hasActions(u);
      if (u.overwatch) return 'Weapon reserved for overwatch';
      if (u.ammo <= 0) return 'Out of ammo';
      return t ? targetBlock(s, u, t) : 'Invalid target';
    }
    case 'reload':
      if (hasActions(u)) return hasActions(u);
      if (u.ammo >= CLASSES[u.cls].weapon.magazine) return 'Magazine full';
      return u.reserve > 0 ? null : 'No reserve ammo';
    case 'overwatch':
      if (hasActions(u)) return hasActions(u);
      if (u.ammo <= 0) return 'Out of ammo';
      return u.overwatch ? 'Already on overwatch' : null;
    case 'aid':
      return aidBlock(u, unitById(s, a.target));
    case 'revive':
      return reviveBlock(u, unitById(s, a.target));
    case 'interact':
      return a.target !== undefined ? interactableBlock(s, u, a.target) : interactBlock(s, u);
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
    case 'reload': {
      u.actions--;
      const draw = Math.min(CLASSES[u.cls].weapon.magazine - u.ammo, u.reserve); // 4: a low reserve gives a partial refill
      u.ammo += draw;
      u.reserve -= draw;
      u.reserveUsed += draw;
      emit(s, { t: 'reload', unit: u.id }, [u]);
      break;
    }
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
    case 'revive': {
      const t = unitById(s, a.target)!;
      u.actions--;
      u.medkits--;
      u.revives++;
      t.downed = false;
      t.bleedOut = 0;
      t.hp = Math.min(CLASSES[t.cls].hp, RULES.reviveHp);
      emit(s, { t: 'revive', unit: u.id, target: t.id, amount: t.hp, at: { x: t.x, y: t.y } }, [u, t]);
      break;
    }
    case 'interact':
      if (a.target !== undefined) doInteractable(s, u, a.target);
      else {
        u.actions--;
        emit(s, { t: 'objective', unit: u.id }, [u]);
        beginCapture(s, u); // now it has to hold still; the win comes when the rounds run out
      }
      break;
    case 'gadget': doGadget(s, u, a.target, a.rotation); break;
  }
  if (a.type !== 'move') {
    const revealed = expose(s, u); // acting (anything but moving) from a bush gives the position away
    refreshVision(s);
    if (revealed) emit(s, { t: 'exposed', unit: u.id }, [u]);
    triggerOverwatch(s, u);
  }
  if (u.ammo <= 0 && u.reserve <= 0) u.ranDry = true; // ammo (4): sticky, for the sim's balance table
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
  const path = findPath(s, u, to, moveRange(s, u))!;
  u.moveBonus = 0; // adrenaline boosts one move, however far it goes
  u.actions--;
  const ev = emit(s, { t: 'move', unit: u.id, from: { x: u.x, y: u.y }, to }, false);
  const from = { x: u.x, y: u.y };
  // Walk step by step so overwatchers can react mid-path; a dead or downed mover stops.
  for (const p of path) {
    u.x = p.x;
    u.y = p.y;
    collectPickup(s, u); // free (4): walking onto a pickup's tile collects it, no action cost
    refreshVision(s);
    triggerOverwatch(s, u);
    if (!u.alive || u.downed) break;
  }
  ev.seen = (u.team === 'player' || s.seenUnits.player.has(u.id) || s.visible.player[idx(s, from.x, from.y)] === 1);
}

/** Overwatch: each waiting enemy of `actor` fires once if the actor is in range, in LOS and visible to it. */
function triggerOverwatch(s: GameState, actor: Unit) {
  for (const o of s.units) {
    if (!actor.alive || actor.downed) return;
    if (!o.alive || o.downed || !o.overwatch || o.team === actor.team || o.ammo <= 0) continue;
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

/** Free pickup (4): collects whatever is on `u`'s current tile, if anything. Any unit of either team can use it. */
function collectPickup(s: GameState, u: Unit) {
  const i = s.pickups.findIndex((p) => p.x === u.x && p.y === u.y);
  if (i < 0) return;
  const p = s.pickups[i];
  s.pickups.splice(i, 1);
  if (p.type === 'ammo') u.reserve += p.amount;
  else if (p.type === 'medkit') u.medkits += p.amount;
  else if (p.type === 'gadget' && u.gadget) u.gadget.uses += p.amount;
  emit(s, { t: 'pickup', unit: u.id, item: p.type, amount: p.amount, at: { x: u.x, y: u.y } }, [u]);
}

/** Toggle a door or switch (2). A switch also flips every door in its `links`; its own `active` is cosmetic. */
function doInteractable(s: GameState, u: Unit, targetId: number) {
  const it = s.interactables.find((i) => i.id === targetId)!;
  u.actions--;
  it.active = !it.active;
  const at: Pos = { x: it.x, y: it.y }; // never pass `it` itself to emit(): it has an `id` too and would be
  // mistaken for a Unit by isSeenByPlayer's `'id' in w` check.
  if (it.type === 'door') {
    emit(s, { t: 'door', unit: u.id, id: it.id, at, open: it.active }, [u, at]);
  } else {
    const linked: number[] = [];
    for (const doorId of it.links ?? []) {
      const door = s.interactables.find((d) => d.id === doorId && d.type === 'door');
      if (!door) continue;
      door.active = !door.active;
      linked.push(door.id);
    }
    emit(s, { t: 'switch', unit: u.id, id: it.id, at, on: it.active, linked }, [u, at]);
  }
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
