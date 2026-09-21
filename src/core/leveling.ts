import { LEVEL_PATHS, XP_PER_DAMAGE, XP_PER_KILL, XP_PER_REVIVE, XP_SURVIVAL_BONUS } from '../data/leveling';
import { PERKS, type PerkEffect, type PerkId } from '../data/perks';
import type { ClassId } from '../data/units';
import type { ClassProgress } from '../data/trainingGrounds';

export function newClassProgress(): ClassProgress {
  return { xp: 0, level: 1, perkPool: [], equippedPerks: [] };
}

/** The level `xp` reaches on `cls`'s own path (1 if below every threshold). */
export function levelForXp(cls: ClassId, xp: number): number {
  let level = 1;
  for (const def of LEVEL_PATHS[cls]) if (xp >= def.xpThreshold) level = def.level;
  return level;
}

/** How many perks can be equipped at once at `level` - counts every `slotUnlock` milestone reached so far. */
export function slotCount(cls: ClassId, level: number): number {
  return LEVEL_PATHS[cls].filter((d) => d.level <= level && d.slotUnlock).length;
}

function perksGrantedThrough(cls: ClassId, level: number): PerkId[] {
  return LEVEL_PATHS[cls].filter((d) => d.level <= level && d.perksGranted).flatMap((d) => d.perksGranted!);
}

/** XP a unit earned this mission, from its own final stat counters - a post-mission summary, not a live
 *  per-event stream during the mission (see ROADMAP.md's Resolved for why). */
export function xpEarned(u: { dmgDealt: number; kills: number; revives: number; alive: boolean }): number {
  return u.dmgDealt * XP_PER_DAMAGE + u.kills * XP_PER_KILL + u.revives * XP_PER_REVIVE + (u.alive ? XP_SURVIVAL_BONUS : 0);
}

/** Adds XP in place and resolves any level-up, granting newly-reached perks to the pool - never auto-equips
 *  them, the player chooses at the equip screen. */
export function gainXp(cls: ClassId, progress: ClassProgress, amount: number): void {
  progress.xp += amount;
  const newLevel = levelForXp(cls, progress.xp);
  if (newLevel <= progress.level) return;
  progress.level = newLevel;
  for (const id of perksGrantedThrough(cls, newLevel)) if (!progress.perkPool.includes(id)) progress.perkPool.push(id);
}

/**
 * Permadeath (8): XP/level/equipped selection reset to a fresh level-1 state - real stakes, per the design
 * sketch's own suggestion. The unlocked perk pool is NOT cleared, though: it persists permanently, the same
 * way feature 7's `unlockedGear` never gets taken away - "institutional knowledge" survives the individual.
 */
export function resetOnDeath(progress: ClassProgress): void {
  progress.xp = 0;
  progress.level = 1;
  progress.equippedPerks = [];
}

/** Toggles `id` on if it's unlocked and a slot is free; returns why it can't, or null on success (including
 *  a no-op if it's already equipped). */
export function equipPerk(cls: ClassId, progress: ClassProgress, id: PerkId): string | null {
  if (!progress.perkPool.includes(id)) return 'Not unlocked yet';
  if (progress.equippedPerks.includes(id)) return null;
  if (progress.equippedPerks.length >= slotCount(cls, progress.level)) return 'No open perk slots';
  progress.equippedPerks.push(id);
  return null;
}

export function unequipPerk(progress: ClassProgress, id: PerkId): void {
  progress.equippedPerks = progress.equippedPerks.filter((x) => x !== id);
}

/** Combined flat stat bonus from a set of equipped perk ids (any class - ids are unique across all of them). */
export function perkBonus(equippedPerks: PerkId[]): Required<PerkEffect> {
  const out: Required<PerkEffect> = { accuracyBonus: 0, damageBonus: 0, armorBonus: 0, moveBonus: 0, visionBonus: 0, medkitBonus: 0 };
  for (const id of equippedPerks) {
    const effect = PERKS[id].effect;
    for (const key of Object.keys(effect) as (keyof PerkEffect)[]) out[key] += effect[key] ?? 0;
  }
  return out;
}
