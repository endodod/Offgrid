import type { ClassId } from './units';
import type { PerkId } from './perks';

/** XP earned from a mission's own final stat counters (8) - see core/leveling.ts's `xpEarned`. Not a live
 *  per-event stream during the mission - see ROADMAP.md's Resolved for why. Placeholder numbers, tune via sim. */
export const XP_PER_DAMAGE = 1;
export const XP_PER_KILL = 15;
export const XP_PER_REVIVE = 10;
export const XP_SURVIVAL_BONUS = 5;

/** One milestone on a class's leveling path. `perksGranted` adds 2 perks to the pool; `slotUnlock` allows one
 *  more perk to be equipped at once (starts at 1, caps at 3 - three `slotUnlock` milestones total). */
export interface LevelDef {
  level: number;
  xpThreshold: number;
  perksGranted?: [PerkId, PerkId];
  slotUnlock?: boolean;
}

/** A shared 5-level curve, parameterized by each class's own 4 perks (2 granted at level 2, 2 at level 4) -
 *  see ROADMAP.md's Resolved for why every class uses the same thresholds/shape in v1. */
function path(perks: [PerkId, PerkId, PerkId, PerkId]): LevelDef[] {
  return [
    { level: 1, xpThreshold: 0, slotUnlock: true },
    { level: 2, xpThreshold: 100, perksGranted: [perks[0], perks[1]] },
    { level: 3, xpThreshold: 250, slotUnlock: true },
    { level: 4, xpThreshold: 450, perksGranted: [perks[2], perks[3]] },
    { level: 5, xpThreshold: 700, slotUnlock: true },
  ];
}

export const LEVEL_PATHS: Record<ClassId, LevelDef[]> = {
  sniper: path(['sniperFocus', 'sniperEagleEye', 'sniperSteadyHands', 'sniperFieldcraft']),
  assault: path(['assaultSprinter', 'assaultTrigger', 'assaultBulwark', 'assaultReflexes']),
  soldier: path(['soldierGrit', 'soldierMarksman', 'soldierScout', 'soldierHustle']),
  medic: path(['medicTriage', 'medicSharpshooter', 'medicFleetfoot', 'medicWard']),
  tank: path(['tankPlating', 'tankBrace', 'tankStrider', 'tankVigilance']),
};

export const MAX_LEVEL = 5;
export const MAX_SLOTS = 3;
