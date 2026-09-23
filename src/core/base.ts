import { FACILITIES, FACILITY_ORDER, INFIRMARY_HEAL, LOCKER_BASE, RECRUIT_BASE_CANDIDATES, RECRUIT_XP, REST_BASE, ROSTER_BASE, ROSTER_PER_BARRACKS, type FacilityId } from '../data/base';

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

// ---------- between-mission station effects (11) ----------
/** Share of max HP a soldier who sat the mission out recovers (the barracks, else REST_BASE). */
export const restRate = (base: BaseState): number => facilityEffect(base, 'barracks') || REST_BASE;
/** Beds in the infirmary (0 unbuilt). */
export const infirmaryBeds = (base: BaseState): number => facilityEffect(base, 'infirmary');
/** Share of max HP a soldier in an infirmary bed recovers per mission. */
export const infirmaryHeal = (base: BaseState): number => {
  const level = facilityLevel(base, 'infirmary');
  return level > 0 ? INFIRMARY_HEAL[Math.min(level, INFIRMARY_HEAL.length) - 1] : 0;
};
/** How many spare pieces the locker holds. */
export const lockerCapacity = (base: BaseState): number => facilityEffect(base, 'locker') || LOCKER_BASE;
/** 0 = no recon, 1 = layout, 2 = + hostiles, 3 = + caches and objective. */
export const reconLevel = (base: BaseState): number => facilityEffect(base, 'reconUplink');
/** The highest recipe tier the fabricator can make (0 = none). */
export const fabricatorTier = (base: BaseState): number => facilityEffect(base, 'fabricator');
/** XP a soldier who sat the mission out gains. */
export const trainingXp = (base: BaseState): number => facilityEffect(base, 'trainingRoom');
/** Extra supply runs on offer. */
export const extraOffers = (base: BaseState): number => facilityEffect(base, 'warRoom');
/** How many soldiers the base can house (unit rework). */
export const rosterCapacity = (base: BaseState): number => ROSTER_BASE + ROSTER_PER_BARRACKS * facilityLevel(base, 'barracks');
/** Candidates the recruitment office offers after each mission. */
export const candidateCount = (base: BaseState): number => facilityEffect(base, 'recruitment') || RECRUIT_BASE_CANDIDATES;
/** XP a candidate arrives with. */
export const recruitXp = (base: BaseState): number => RECRUIT_XP[Math.min(facilityLevel(base, 'recruitment'), RECRUIT_XP.length - 1)];
