import type { ArmorId } from './armor';
import type { EquipmentId } from './equipment';

/**
 * Fabricator recipes (11). Every piece of gear can be made from parts once the fabricator reaches the
 * recipe's tier. Scrapping a piece returns about half its recipe cost (core/crafting.ts `scrapValue`), so
 * crafting and scrapping can never be looped for profit.
 */
export type RecipeKind = 'armor' | 'equipment';

export interface Recipe {
  kind: RecipeKind;
  id: ArmorId | EquipmentId;
  parts: number;
  tier: number;
}

export const RECIPES: Recipe[] = [
  { kind: 'equipment', id: 'boots', parts: 4, tier: 1 },
  { kind: 'equipment', id: 'flashlight', parts: 4, tier: 1 },
  { kind: 'armor', id: 'lightVest', parts: 5, tier: 1 },
  { kind: 'equipment', id: 'medPouch', parts: 5, tier: 1 },
  { kind: 'equipment', id: 'nvg', parts: 8, tier: 2 },
  { kind: 'equipment', id: 'bandolier', parts: 7, tier: 2 },
  { kind: 'armor', id: 'ceramicPlate', parts: 9, tier: 2 },
  { kind: 'armor', id: 'heavyPlate', parts: 12, tier: 3 },
];

/** Parts a won mission pays out: a story mission a flat amount, a supply run more at higher tiers. */
export const STORY_PARTS = 4;
export const supplyRunParts = (tier: number): number => 2 + tier;
