import {
  DISTRICT_ORDER, STORY_MISSIONS, SUPPLY_RUN_MAP, SUPPLY_RUN_NAMES, SUPPLY_RUN_PROFILE_TIERS,
  type GeneratedMissionDef, type StoryMissionDef,
} from '../data/campaign';
import type { FacilityId } from '../data/base';
import type { ArmorId } from '../data/armor';
import type { EquipmentId } from '../data/equipment';
import type { ClassId } from '../data/units';
import type { UnitLoadout, ClassProgress } from '../data/trainingGrounds';
import type { PerkId } from '../data/perks';
import { buildLevel, newBaseState, upgradeCost, type BaseState } from './base';
import { equipPerk, gainXp, newClassProgress, resetOnDeath, unequipPerk, xpEarned } from './leveling';
import { nextRandom } from './rng';

/** Persistent progress between missions (5), independent of any single mission's GameState. Mutated in place,
 *  the same style GameState itself uses - see `completeStoryMission`/`completeSupplyRun`. */
export interface CampaignState {
  seed: number;
  rng: number; // mulberry32 cursor (core/rng.ts's nextRandom), so pool generation is deterministic per seed
  unlockedDistricts: string[]; // District ids
  completedStoryMissions: string[]; // StoryMissionDef ids
  completedSupplyRuns: number; // also drives the difficulty/reward tier of newly generated missions
  currency: number; // banked reward; spent on base facilities (6)
  nextSupplyRunSeq: number; // monotonic, so regenerated pool slots never reuse an id within a campaign
  supplyRunPool: GeneratedMissionDef[];
  base: BaseState; // home-base facilities (6)
  loadouts: Partial<Record<ClassId, UnitLoadout>>; // equipment (7): what each class starts its next mission with
  unlockedGear: { armor: ArmorId[]; equipment: EquipmentId[] }; // equipment (7): ever found, so assignable at the equip screen
  levels: Partial<Record<ClassId, ClassProgress>>; // leveling (8): each class's XP/level/perks
}

const POOL_SIZE = 3;

/** A fresh campaign: only the first district unlocked, an empty pool filled in immediately, no facilities
 *  built, gear found, or levels earned yet. */
export function newCampaign(seed = Date.now()): CampaignState {
  const cs: CampaignState = {
    seed, rng: seed, unlockedDistricts: [DISTRICT_ORDER[0]], completedStoryMissions: [],
    completedSupplyRuns: 0, currency: 0, nextSupplyRunSeq: 0, supplyRunPool: [], base: newBaseState(),
    loadouts: {}, unlockedGear: { armor: [], equipment: [] }, levels: {},
  };
  fillPool(cs);
  return cs;
}

/** The minimal shape `recordMissionGear`/`applyMissionXp` need - matches core/types.ts's `Unit` structurally,
 *  but this module deliberately doesn't depend on a live GameState/Unit, only on plain data, to stay testable
 *  in isolation. */
interface EndedUnit {
  team: 'player' | 'enemy'; cls: ClassId; armor: ArmorId | null; equipment: [EquipmentId | null, EquipmentId | null];
  dmgDealt: number; kills: number; revives: number; alive: boolean;
}

/**
 * Called once a campaign-launched mission ends in a win (see ui/campaign.ts's `reportWin`): persists each
 * surviving-or-not player unit's ending loadout back to `cs.loadouts` (so "what the soldier is wearing" carries
 * into the next mission), and permanently unlocks any armor/equipment id found this way for the equip screen.
 */
export function recordMissionGear(cs: CampaignState, units: EndedUnit[]): void {
  for (const u of units) {
    if (u.team !== 'player') continue;
    cs.loadouts[u.cls] = { armor: u.armor, equipment: [...u.equipment] };
    if (u.armor && !cs.unlockedGear.armor.includes(u.armor)) cs.unlockedGear.armor.push(u.armor);
    for (const e of u.equipment) if (e && !cs.unlockedGear.equipment.includes(e)) cs.unlockedGear.equipment.push(e);
  }
}

/**
 * Called alongside `recordMissionGear` once a campaign-launched mission ends in a win: awards each player
 * unit's class the XP it earned this mission (from its own final stat counters - see core/leveling.ts's
 * `xpEarned`), resolving any level-up and granting newly-unlocked perks to the pool. A unit that died for
 * good instead resets its class to level 1 (permadeath - see ROADMAP.md's Resolved for why the perk pool
 * itself survives this).
 */
export function applyMissionXp(cs: CampaignState, units: EndedUnit[]): void {
  for (const u of units) {
    if (u.team !== 'player') continue;
    const progress = cs.levels[u.cls] ?? newClassProgress();
    if (u.alive) gainXp(u.cls, progress, xpEarned(u));
    else resetOnDeath(progress);
    cs.levels[u.cls] = progress;
  }
}

/** Toggles perk `id` equipped/unequipped for `cls`, or returns why it can't be equipped (unequipping never fails). */
export function togglePerk(cs: CampaignState, cls: ClassId, id: PerkId): string | null {
  const progress = cs.levels[cls] ?? newClassProgress();
  cs.levels[cls] = progress;
  if (progress.equippedPerks.includes(id)) {
    unequipPerk(progress, id);
    return null;
  }
  return equipPerk(cls, progress, id);
}

/** Spends currency to build/upgrade a facility one level, or returns why it can't (nothing is charged then). */
export function upgradeFacility(cs: CampaignState, id: FacilityId): string | null {
  const cost = upgradeCost(cs.base, id);
  if (cost === null) return 'Already at max level';
  if (cs.currency < cost) return 'Not enough currency';
  cs.currency -= cost;
  buildLevel(cs.base, id);
  return null;
}

/** Which difficulty tier newly generated missions draw from - one step harder every 3 completed supply runs. */
function tierFor(cs: CampaignState): number {
  return Math.min(SUPPLY_RUN_PROFILE_TIERS.length - 1, Math.floor(cs.completedSupplyRuns / 3));
}

function generateOne(cs: CampaignState): GeneratedMissionDef {
  const tier = tierFor(cs);
  const profiles = SUPPLY_RUN_PROFILE_TIERS[tier];
  const name = SUPPLY_RUN_NAMES[Math.floor(nextRandom(cs) * SUPPLY_RUN_NAMES.length)];
  const enemyProfile = profiles[Math.floor(nextRandom(cs) * profiles.length)];
  const reward = 100 + tier * 50 + Math.floor(nextRandom(cs) * 50);
  return {
    id: `supply-run-${cs.nextSupplyRunSeq++}`,
    name, blurb: `A generated supply run - tier ${tier + 1} resistance.`,
    map: SUPPLY_RUN_MAP, enemyProfile, reward,
  };
}

/** Tops the pool back up to `POOL_SIZE` after a completion (or on a fresh campaign). */
function fillPool(cs: CampaignState) {
  while (cs.supplyRunPool.length < POOL_SIZE) cs.supplyRunPool.push(generateOne(cs));
}

export type DistrictStatus = 'locked' | 'available' | 'completed';

export function districtStatus(cs: CampaignState, districtId: string): DistrictStatus {
  if (!cs.unlockedDistricts.includes(districtId)) return 'locked';
  const missions = STORY_MISSIONS.filter((m) => m.district === districtId);
  if (missions.length && missions.every((m) => cs.completedStoryMissions.includes(m.id))) return 'completed';
  return 'available';
}

/** Story missions the player can play right now: in an unlocked, not-yet-completed district. */
export function availableStoryMissions(cs: CampaignState): StoryMissionDef[] {
  return STORY_MISSIONS.filter((m) => cs.unlockedDistricts.includes(m.district) && !cs.completedStoryMissions.includes(m.id));
}

/** Marks a story mission won; unlocks the next district once every mission in the current one is done. */
export function completeStoryMission(cs: CampaignState, missionId: string): void {
  if (cs.completedStoryMissions.includes(missionId)) return;
  const m = STORY_MISSIONS.find((x) => x.id === missionId);
  if (!m) return;
  cs.completedStoryMissions.push(missionId);
  if (districtStatus(cs, m.district) !== 'completed') return;
  const next = DISTRICT_ORDER[DISTRICT_ORDER.indexOf(m.district) + 1];
  if (next && !cs.unlockedDistricts.includes(next)) cs.unlockedDistricts.push(next);
}

/** Marks a generated mission won: banks its reward, retires it, and regenerates the pool back up to size. */
export function completeSupplyRun(cs: CampaignState, missionId: string): void {
  const i = cs.supplyRunPool.findIndex((m) => m.id === missionId);
  if (i < 0) return;
  cs.currency += cs.supplyRunPool[i].reward;
  cs.supplyRunPool.splice(i, 1);
  cs.completedSupplyRuns++;
  fillPool(cs);
}
