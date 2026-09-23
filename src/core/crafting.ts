import { RECIPES, type Recipe, type RecipeKind } from '../data/crafting';
import { fabricatorTier, lockerCapacity } from './base';
import { addGear, stockOf, takeGear, type CampaignState, type GearInventory } from './campaign';

/** The fabricator and the locker (11): making gear from parts, scrapping it back, and the locker's size. */

export const recipeFor = (kind: RecipeKind, id: string): Recipe | undefined => RECIPES.find((r) => r.kind === kind && r.id === id);

/** Parts returned for scrapping one piece: half its recipe, at least 1. */
export const scrapValue = (kind: RecipeKind, id: string): number => Math.max(1, Math.floor((recipeFor(kind, id)?.parts ?? 2) / 2));

/** Total pieces in the locker (not counting what the squad is wearing). */
export const lockerCount = (inv: GearInventory): number =>
  [...Object.values(inv.armor), ...Object.values(inv.equipment)].reduce<number>((n, c) => n + (c ?? 0), 0);

/** Why `r` can't be crafted right now, or null if it can. */
export function craftBlocker(cs: CampaignState, r: Recipe): string | null {
  if (fabricatorTier(cs.base) < r.tier) return r.tier === 1 ? 'Build the fabricator first' : `Needs fabricator level ${r.tier}`;
  if (cs.parts < r.parts) return 'Not enough parts';
  if (lockerCount(cs.inventory) >= lockerCapacity(cs.base)) return 'The locker is full';
  return null;
}

/** Crafts one of `r` into the locker. Returns why not (and changes nothing) if it can't. */
export function craft(cs: CampaignState, r: Recipe): string | null {
  const err = craftBlocker(cs, r);
  if (err) return err;
  cs.parts -= r.parts;
  addGear(cs.inventory, r.kind, r.id);
  return null;
}

/** Scraps one `id` from the locker for parts. Returns why not if there is none. */
export function scrap(cs: CampaignState, kind: RecipeKind, id: string): string | null {
  if (!takeGear(cs.inventory, kind, id)) return 'Not in the locker';
  cs.parts += scrapValue(kind, id);
  return null;
}

/**
 * Brings the locker back under capacity after a mission by scrapping the surplus: first duplicates of
 * whatever the locker holds most of, so a single unique piece is the last thing to go. Returns what was
 * scrapped, by recipe, for the after-action report.
 */
export function trimLocker(cs: CampaignState): { kind: RecipeKind; id: string; parts: number }[] {
  const out: { kind: RecipeKind; id: string; parts: number }[] = [];
  const cap = lockerCapacity(cs.base);
  while (lockerCount(cs.inventory) > cap) {
    const all = (['armor', 'equipment'] as const).flatMap((kind) =>
      Object.keys(cs.inventory[kind]).map((id) => ({ kind, id, n: stockOf(cs.inventory, kind, id) })));
    all.sort((a, b) => b.n - a.n || scrapValue(a.kind, a.id) - scrapValue(b.kind, b.id));
    const victim = all[0];
    const parts = scrapValue(victim.kind, victim.id);
    scrap(cs, victim.kind, victim.id);
    out.push({ kind: victim.kind, id: victim.id, parts });
  }
  return out;
}
