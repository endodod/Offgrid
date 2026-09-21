import type { ArmorId } from './armor';
import type { EquipmentId } from './equipment';

/** One weighted entry in the shared loot table (7) - a chest or an enemy death rolls against this. */
export interface LootEntry {
  itemType: 'armor' | 'equipment';
  itemId: ArmorId | EquipmentId;
  weight: number;
}

export const LOOT_TABLE: LootEntry[] = [
  { itemType: 'armor', itemId: 'lightVest', weight: 3 },
  { itemType: 'armor', itemId: 'heavyPlate', weight: 1 },
  { itemType: 'equipment', itemId: 'boots', weight: 3 },
  { itemType: 'equipment', itemId: 'flashlight', weight: 2 },
  { itemType: 'equipment', itemId: 'nvg', weight: 2 },
];

/** Resolves a pre-rolled number in [0, 1) to a loot table entry, weighted. Pure - the caller supplies the
 *  roll (via the seeded RNG in core), so the result stays deterministic for a given seed. */
export function rollLoot(roll: number): LootEntry {
  const total = LOOT_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let acc = roll * total;
  for (const entry of LOOT_TABLE) {
    if (acc < entry.weight) return entry;
    acc -= entry.weight;
  }
  return LOOT_TABLE[LOOT_TABLE.length - 1];
}
