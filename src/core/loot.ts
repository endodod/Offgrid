import { rollLoot } from '../data/loot';
import { nextRandom } from './rng';
import type { GameState, Unit } from './types';

/** Next free pickup id - same "max + 1" scheme the map builder already uses for interactables/pickups. */
const nextPickupId = (s: GameState) => s.pickups.reduce((m, p) => Math.max(m, p.id), 0) + 1;

/**
 * Rolls the shared loot table (7) and drops the result as an ordinary pickup at (x, y) - reusing the
 * pickup-on-tile mechanism from consumables (4) rather than inventing a second delivery path, per the design
 * sketch. Called from an enemy death (`lootOnDeath` below) and from opening a chest (core/actions.ts). No
 * event of its own: the drop is discovered visually (render/renderer.ts's `drawPickups`) and logged for real
 * once a unit actually collects it, via the existing 'pickup' event `core/actions.ts`'s `collectPickup` emits.
 */
export function dropLoot(s: GameState, x: number, y: number) {
  const entry = rollLoot(nextRandom(s));
  const id = nextPickupId(s);
  s.pickups.push({ id, type: entry.itemType, x, y, amount: 1, itemId: entry.itemId });
}

/**
 * An enemy that dies drops loot, regardless of *how* it died - a finishing shot (core/combat.ts's
 * `finalizeDeath`) and bleeding out (core/state.ts's `tickBleedOut`) are two separate death paths in this
 * codebase, so this is called from both rather than living inside either one, to avoid a circular import
 * between combat.ts and state.ts (each already imports something from the other).
 */
export function lootOnDeath(s: GameState, target: Unit) {
  if (target.team === 'enemy') dropLoot(s, target.x, target.y);
}
