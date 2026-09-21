import { CLASSES } from '../data/units';
import { RULES } from '../data/rules';
import { envMods } from './environment';
import { dist, hasLos, idx, inBounds } from './grid';
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
  const raw = CLASSES[attacker.cls].weapon.accuracy - coverAgainst(s, target, from).penalty + envMods(s).accuracyMod;
  return Math.min(RULES.hitClamp.max, Math.max(RULES.hitClamp.min, raw));
}

export const damageAgainst = (damage: number, armor: number) => Math.max(1, damage - armor);

/** Expected damage of one attack action (all shots) - used by the AI to pick targets. */
export function expectedDamage(s: GameState, attacker: Unit, target: Unit, from: Pos = attacker): number {
  const w = CLASSES[attacker.cls].weapon;
  return (hitChance(s, attacker, target, from) / 100) * damageAgainst(w.damage, CLASSES[target.cls].armor) * w.shots;
}

/** Geometry + fog check shared by attacks and overwatch: range, own LOS, and target visible to the attacker's team. */
export function targetBlock(s: GameState, attacker: Unit, target: Unit): string | null {
  if (!target.alive || target.team === attacker.team) return 'Invalid target';
  if (dist(attacker, target) > CLASSES[attacker.cls].weapon.range) return 'Out of range';
  if (!hasLos(s, attacker, target)) return 'No line of sight';
  if (!s.seenUnits[attacker.team].has(target.id)) return 'Target not visible';
  return null;
}

export function applyDamage(s: GameState, target: Unit, amount: number, source: Unit | null) {
  const dealt = Math.min(amount, target.hp);
  target.hp -= dealt;
  target.dmgTaken += dealt;
  if (source && source.team !== target.team) source.dmgDealt += dealt;
  if (target.hp > 0) return;
  target.alive = false;
  target.overwatch = false;
  if (source && source.team !== target.team) source.kills++;
  emit(s, { t: 'died', unit: target.id, at: { x: target.x, y: target.y } }, [target]);
}

/** Resolves one attack (all shots of the weapon). The caller pays the ammo/action cost. */
export function fireWeapon(s: GameState, attacker: Unit, target: Unit, overwatch: boolean) {
  const w = CLASSES[attacker.cls].weapon;
  const chance = hitChance(s, attacker, target);
  for (let i = 0; i < w.shots && target.alive; i++) {
    const roll = rollPercent(s);
    const hit = roll < chance;
    const damage = hit ? damageAgainst(w.damage, CLASSES[target.cls].armor) : 0;
    emit(s, {
      t: 'shot', attacker: attacker.id, target: target.id, shot: i + 1, shots: w.shots, chance, roll, hit, damage,
      overwatch, at: { x: target.x, y: target.y }, from: { x: attacker.x, y: attacker.y },
    }, [attacker, target]);
    if (hit) applyDamage(s, target, damage, attacker);
  }
}
