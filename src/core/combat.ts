import { CLASSES } from '../data/units';
import { RULES } from '../data/rules';
import { ARMOR } from '../data/armor';
import { effectiveAccuracyMod } from './environment';
import { dist, hasLos, idx, inBounds } from './grid';
import { lootOnDeath } from './loot';
import { rollPercent } from './rng';
import { emit } from './state';
import type { Cover, CoverState, GameState, Pos, Unit } from './types';

export const coverAt = (s: GameState, x: number, y: number): Cover | null =>
  inBounds(s, x, y) ? s.cover[idx(s, x, y)] : null;

/**
 * Protection a tile gives a unit standing next to it: cover objects, and walls count as high cover.
 * Only used for hit chance. Gadgets keep using `coverAt`, so a grenade or tank can never turn a wall into cover.
 */
export const shelterAt = (s: GameState, x: number, y: number): Cover | null =>
  inBounds(s, x, y) && s.terrain[idx(s, x, y)] === 'wall' ? 'high' : coverAt(s, x, y);

const rank = (c: Cover | null) => (c === 'high' ? 2 : c === 'low' ? 1 : 0);

/**
 * Cover the target gets against an attacker at `from`. Only the orthogonal neighbour facing the attacker counts;
 * for diagonal approaches (neither axis at least twice the other) both facing neighbours are checked, best wins.
 * Walls count as high cover (see `shelterAt`).
 * If nothing faces the attacker but cover exists elsewhere around the target, it is flanked.
 */
export function coverAgainst(s: GameState, target: Pos, from: Pos): { state: CoverState; penalty: number } {
  const dx = Math.sign(from.x - target.x), dy = Math.sign(from.y - target.y);
  const ax = Math.abs(from.x - target.x), ay = Math.abs(from.y - target.y);
  const facing: Pos[] = [];
  if (ay * 2 <= ax) facing.push({ x: target.x + dx, y: target.y }); // mostly east/west
  else if (ax * 2 <= ay) facing.push({ x: target.x, y: target.y + dy }); // mostly north/south
  else {
    if (dx !== 0) facing.push({ x: target.x + dx, y: target.y });
    if (dy !== 0) facing.push({ x: target.x, y: target.y + dy });
  }
  const best = facing.map((p) => shelterAt(s, p.x, p.y)).reduce<Cover | null>((b, c) => (rank(c) > rank(b) ? c : b), null);
  if (best) return { state: best, penalty: RULES.coverPenalty[best] };
  const anyAround = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => shelterAt(s, target.x + ox, target.y + oy));
  return { state: anyAround ? 'flanked' : 'none', penalty: 0 };
}

export function hitChance(s: GameState, attacker: Unit, target: Unit, from: Pos = attacker): number {
  const raw = CLASSES[attacker.cls].weapon.accuracy - coverAgainst(s, target, from).penalty + effectiveAccuracyMod(s, attacker);
  return Math.min(RULES.hitClamp.max, Math.max(RULES.hitClamp.min, raw));
}

export const damageAgainst = (damage: number, armor: number) => Math.max(1, damage - armor);

/** A unit's armor after its class base plus any equipped armor piece (7) - stacks, doesn't replace. */
export const effectiveArmor = (u: Unit): number => CLASSES[u.cls].armor + (u.armor ? ARMOR[u.armor].armorBonus : 0);

/** Expected damage of one attack action (all shots) - used by the AI to pick targets. */
export function expectedDamage(s: GameState, attacker: Unit, target: Unit, from: Pos = attacker): number {
  const w = CLASSES[attacker.cls].weapon;
  return (hitChance(s, attacker, target, from) / 100) * damageAgainst(w.damage, effectiveArmor(target)) * w.shots;
}

/** Geometry + fog check shared by attacks and overwatch: range, own LOS, and target visible to the attacker's team. */
export function targetBlock(s: GameState, attacker: Unit, target: Unit): string | null {
  if (!target.alive || target.team === attacker.team) return 'Invalid target';
  if (dist(attacker, target) > CLASSES[attacker.cls].weapon.range) return 'Out of range';
  if (!hasLos(s, attacker, target)) return 'No line of sight';
  if (!s.seenUnits[attacker.team].has(target.id)) return 'Target not visible';
  return null;
}

/**
 * A downed unit (hp already 0) dies for good from any further hit, regardless of amount - it has no HP left to
 * lose. Otherwise hp reaching 0 downs the unit instead of killing it outright; see RULES.bleedOutRounds.
 */
export function applyDamage(s: GameState, target: Unit, amount: number, source: Unit | null) {
  const dealt = Math.min(amount, target.hp);
  target.dmgTaken += Math.max(dealt, 0);
  if (source && source.team !== target.team) source.dmgDealt += Math.max(dealt, 0);
  if (target.downed) {
    finalizeDeath(s, target, source);
    return;
  }
  target.hp -= dealt;
  if (target.hp > 0) return;
  target.downed = true;
  target.bleedOut = RULES.bleedOutRounds;
  target.overwatch = false;
  emit(s, { t: 'downed', unit: target.id, at: { x: target.x, y: target.y } }, [target]);
}

function finalizeDeath(s: GameState, target: Unit, source: Unit | null) {
  target.alive = false;
  target.downed = false;
  target.overwatch = false;
  if (source && source.team !== target.team) source.kills++;
  emit(s, { t: 'died', unit: target.id, at: { x: target.x, y: target.y } }, [target]);
  lootOnDeath(s, target); // loot (7): only enemies drop gear
}

/**
 * Resolves one attack (all shots of the weapon). The caller pays the ammo/action cost. A downed target can't
 * fight back or move away, so finishing it off is a guaranteed kill rather than a normal hit-chance roll.
 */
export function fireWeapon(s: GameState, attacker: Unit, target: Unit, overwatch: boolean) {
  const w = CLASSES[attacker.cls].weapon;
  if (target.downed) {
    const damage = damageAgainst(w.damage, effectiveArmor(target));
    emit(s, {
      t: 'shot', attacker: attacker.id, target: target.id, shot: 1, shots: 1, chance: 100, roll: 0, hit: true,
      damage, overwatch, finishing: true, at: { x: target.x, y: target.y }, from: { x: attacker.x, y: attacker.y },
    }, [attacker, target]);
    applyDamage(s, target, damage, attacker);
    return;
  }
  const chance = hitChance(s, attacker, target);
  for (let i = 0; i < w.shots && target.alive && !target.downed; i++) {
    const roll = rollPercent(s);
    const hit = roll < chance;
    const damage = hit ? damageAgainst(w.damage, effectiveArmor(target)) : 0;
    emit(s, {
      t: 'shot', attacker: attacker.id, target: target.id, shot: i + 1, shots: w.shots, chance, roll, hit, damage,
      overwatch, finishing: false, at: { x: target.x, y: target.y }, from: { x: attacker.x, y: attacker.y },
    }, [attacker, target]);
    if (hit) applyDamage(s, target, damage, attacker);
  }
}
