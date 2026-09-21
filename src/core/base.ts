import { FACILITIES, FACILITY_ORDER, type FacilityId } from '../data/base';

/** Built facilities and their levels (6), persisted as part of the campaign save (5). 0 = not yet built. */
export interface BaseState {
  levels: Record<FacilityId, number>;
}

export function newBaseState(): BaseState {
  const levels = {} as Record<FacilityId, number>;
  for (const id of FACILITY_ORDER) levels[id] = 0;
  return { levels };
}

export const facilityLevel = (base: BaseState, id: FacilityId): number => base.levels[id] ?? 0;

/** The cost to build/upgrade `id` to its next level, or null once it's already at max. */
export function upgradeCost(base: BaseState, id: FacilityId): number | null {
  const tiers = FACILITIES[id].tiers;
  const level = facilityLevel(base, id);
  return level < tiers.length ? tiers[level].cost : null;
}

/** The facility's current effect value (0 if unbuilt) - meaning is facility-specific, see data/base.ts. */
export function facilityEffect(base: BaseState, id: FacilityId): number {
  const level = facilityLevel(base, id);
  return level > 0 ? FACILITIES[id].tiers[level - 1].effect : 0;
}

/** Mutates `base` to the next level for `id`. The caller (core/campaign.ts) checks/deducts cost first. */
export function buildLevel(base: BaseState, id: FacilityId) {
  base.levels[id] = facilityLevel(base, id) + 1;
}

/**
 * The meta-progression bonuses a built base grants to every mission launched from the campaign screen (6) -
 * bonus amounts, not final values, since the caller (ui/campaign.ts's `applyBase`) still layers them onto
 * whatever a specific mission's own `MapDef` already specifies (e.g. a scarcer mission's own `reserveMult`).
 */
export function baseGameOptions(base: BaseState): { medkitBonus: number; reserveMultBonus: number; gadgetUsesBonus: number } {
  return {
    medkitBonus: facilityEffect(base, 'medstation'),
    reserveMultBonus: facilityEffect(base, 'workbench'),
    gadgetUsesBonus: facilityEffect(base, 'commsRelay'),
  };
}
