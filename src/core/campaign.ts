import {
  DISTRICT_ORDER, STORY_MISSIONS, SUPPLY_RUN_CALLSIGNS, SUPPLY_RUN_COMPLICATIONS, SUPPLY_RUN_PROFILE_TIERS,
  SUPPLY_RUN_TEMPLATES, supplyRunComplication, supplyRunTemplate,
  type GeneratedMissionDef, type StoryMissionDef,
} from '../data/campaign';
import type { MapDef } from '../data/trainingGrounds';
import type { FacilityId } from '../data/base';
import type { ArmorId } from '../data/armor';
import type { EquipmentId } from '../data/equipment';
import { CLASS_ORDER, type ClassId } from '../data/units';
import { FIRST_NAMES, FOUNDERS, LAST_NAMES } from '../data/names';
import type { UnitLoadout, ClassProgress } from '../data/trainingGrounds';
import type { PerkId } from '../data/perks';
import { buildLevel, candidateCount, extraOffers, newBaseState, recruitXp, upgradeCost, type BaseState } from './base';
import { STORY_PARTS, supplyRunParts } from '../data/crafting';
import { equipPerk, gainXp, newClassProgress, slotCount, unequipPerk, xpEarned } from './leveling';
import { nextRandom } from './rng';

/** Persistent progress between missions (5), independent of any single mission's GameState. Mutated in place,
 *  the same style GameState itself uses - see `completeStoryMission`/`completeSupplyRun`. */
export interface CampaignState {
  seed: number;
  rng: number; // mulberry32 cursor (core/rng.ts's nextRandom), so pool generation is deterministic per seed
  unlockedDistricts: string[]; // District ids
  seenIntros: string[]; // District ids whose briefing modal has already been shown
  completedStoryMissions: string[]; // StoryMissionDef ids
  completedSupplyRuns: number; // also drives the difficulty/reward tier of newly generated missions
  currency: number; // banked reward; spent on base facilities (6)
  nextSupplyRunSeq: number; // monotonic, so regenerated pool slots never reuse an id within a campaign
  supplyRunPool: GeneratedMissionDef[];
  base: BaseState; // home-base facilities (6)
  inventory: GearInventory; // equipment (7): the locker - owned pieces that are *not* currently equipped
  parts: number; // base overhaul (11): the fabricator's material, from missions and scrapping
  roster: Soldier[]; // unit rework (13): everyone on the books, any number per class
  recruits: Soldier[]; // (13) candidates the recruitment office is offering right now
  nextSoldierSeq: number; // (13) monotonic, for soldier ids
  infirmary: string[]; // (11) soldier ids in an infirmary bed
}

/**
 * One person on the squad's books (13). Gear, XP, perks and wounds belong to the soldier, not the class, so
 * a campaign can field two snipers or none. The five founders use their class id as their soldier id, which
 * is also how a save from before the rework maps onto them.
 */
export interface Soldier {
  id: string;
  name: string;
  cls: ClassId;
  loadout: UnitLoadout;
  progress: ClassProgress;
  hp?: number; // carried-over HP; missing = full (core/roster.ts)
}

export const soldierById = (cs: CampaignState, id: string): Soldier | undefined => cs.roster.find((s) => s.id === id);

export function newSoldier(id: string, name: string, cls: ClassId, xp = 0): Soldier {
  const progress = newClassProgress();
  if (xp) gainXp(cls, progress, xp);
  return { id, name, cls, loadout: emptyLoadout(), progress };
}

const founders = (): Soldier[] => CLASS_ORDER.map((cls) => newSoldier(cls, FOUNDERS[cls], cls));

const pickFrom = <T>(cs: CampaignState, list: readonly T[]): T => list[Math.floor(nextRandom(cs) * list.length)];

/** A fresh set of candidates for the recruitment office (13), from the campaign's seeded RNG. */
export function rollRecruits(cs: CampaignState): void {
  const taken = new Set(cs.roster.map((s) => s.name));
  const xp = recruitXp(cs.base);
  cs.recruits = [];
  for (let i = 0; i < candidateCount(cs.base); i++) {
    let name = '';
    for (let tries = 0; tries < 8 && (!name || taken.has(name)); tries++) name = `${pickFrom(cs, FIRST_NAMES)} ${pickFrom(cs, LAST_NAMES)}`;
    taken.add(name);
    cs.recruits.push(newSoldier(`r${cs.nextSoldierSeq++}`, name, pickFrom(cs, CLASS_ORDER), xp));
  }
}

const POOL_SIZE = 3;

/** A fresh campaign: only the first district unlocked, an empty pool filled in immediately, no facilities
 *  built, gear found, or levels earned yet. */
export function newCampaign(seed = Date.now()): CampaignState {
  const cs: CampaignState = {
    seed, rng: seed, unlockedDistricts: [DISTRICT_ORDER[0]], seenIntros: [], completedStoryMissions: [],
    completedSupplyRuns: 0, currency: 0, nextSupplyRunSeq: 0, supplyRunPool: [], base: newBaseState(),
    inventory: newGearInventory(), parts: 0, roster: founders(), recruits: [], nextSoldierSeq: 0, infirmary: [],
  };
  fillPool(cs);
  rollRecruits(cs);
  return cs;
}

/** The minimal shape `recordMissionGear`/`applyMissionXp` need - matches core/types.ts's `Unit` structurally,
 *  but this module deliberately doesn't depend on a live GameState/Unit, only on plain data, to stay testable
 *  in isolation. */
interface EndedUnit {
  team: 'player' | 'enemy'; cls: ClassId; armor: ArmorId | null; equipment: [EquipmentId | null, EquipmentId | null];
  dmgDealt: number; kills: number; revives: number; alive: boolean;
  soldierId?: string; // which soldier this was (13); missing = the founder of that class
}

/** The soldier an ended unit was, if they're on the books. */
const soldierOf = (cs: CampaignState, u: EndedUnit): Soldier | undefined => soldierById(cs, u.soldierId ?? u.cls);

/**
 * Owned gear that is not on anybody: a count per id, for both slot kinds. Counts rather than a flat "ever
 * found" list, because the equip screen is a locker you drag things out of - an item that stayed visible
 * after being equipped onto all five classes would be lying about what the squad owns.
 */
export interface GearInventory {
  armor: Partial<Record<ArmorId, number>>;
  equipment: Partial<Record<EquipmentId, number>>;
}

export type GearKind = keyof GearInventory;
/** The three gear slots a class has, as the equip screen addresses them. */
export type GearSlot = 'armor' | 'equip0' | 'equip1';

export const SLOT_KIND: Record<GearSlot, GearKind> = { armor: 'armor', equip0: 'equipment', equip1: 'equipment' };

export const newGearInventory = (): GearInventory => ({ armor: {}, equipment: {} });

export const stockOf = (inv: GearInventory, kind: GearKind, id: string): number =>
  (inv[kind] as Record<string, number | undefined>)[id] ?? 0;

export function addGear(inv: GearInventory, kind: GearKind, id: string, n = 1): void {
  const bucket = inv[kind] as Record<string, number | undefined>;
  bucket[id] = (bucket[id] ?? 0) + n;
}

/** Removes one of `id` from the locker. Returns false (and changes nothing) if there is none. */
export function takeGear(inv: GearInventory, kind: GearKind, id: string): boolean {
  const bucket = inv[kind] as Record<string, number | undefined>;
  const have = bucket[id] ?? 0;
  if (have <= 0) return false;
  if (have === 1) delete bucket[id];
  else bucket[id] = have - 1;
  return true;
}

/** Every owned id of a kind, in a stable order, with its count. */
export function gearStock(inv: GearInventory, kind: GearKind, order: readonly string[]): { id: string; count: number }[] {
  return order.map((id) => ({ id, count: stockOf(inv, kind, id) })).filter((e) => e.count > 0);
}

const emptyLoadout = (): UnitLoadout => ({ armor: null, equipment: [null, null] });

/** A soldier's loadout, mutable in place. An unknown id gets a throwaway empty one. */
export function loadoutFor(cs: CampaignState, id: string): UnitLoadout {
  return soldierById(cs, id)?.loadout ?? emptyLoadout();
}

export const gearInSlot = (lo: UnitLoadout, slot: GearSlot): ArmorId | EquipmentId | null =>
  slot === 'armor' ? lo.armor : lo.equipment[slot === 'equip0' ? 0 : 1];

function writeSlot(lo: UnitLoadout, slot: GearSlot, id: ArmorId | EquipmentId | null): void {
  if (slot === 'armor') lo.armor = id as ArmorId | null;
  else lo.equipment[slot === 'equip0' ? 0 : 1] = id as EquipmentId | null;
}

/** Takes whatever is in `slot` off the class and puts it back in the locker. No-op on an empty slot. */
export function unequipToInventory(cs: CampaignState, cls: string, slot: GearSlot): void {
  const lo = loadoutFor(cs, cls);
  const current = gearInSlot(lo, slot);
  if (!current) return;
  addGear(cs.inventory, SLOT_KIND[slot], current);
  writeSlot(lo, slot, null);
}

/** Moves one `id` out of the locker into `slot`, displacing whatever was there back into the locker.
 *  Returns null on success, or why it was refused (nothing changes then). */
export function equipFromInventory(cs: CampaignState, cls: string, slot: GearSlot, id: ArmorId | EquipmentId): string | null {
  const kind = SLOT_KIND[slot];
  if (gearInSlot(loadoutFor(cs, cls), slot) === id) return null; // already there
  if (!takeGear(cs.inventory, kind, id)) return 'Not in the locker';
  unequipToInventory(cs, cls, slot);
  writeSlot(loadoutFor(cs, cls), slot, id);
  return null;
}

/** Drag from one equipped slot to another (same class or not): unequip, then equip, so the locker bookkeeping
 *  is the same code either way. Dropping onto the slot it came from is a no-op. */
export function moveEquipped(
  cs: CampaignState, from: { cls: string; slot: GearSlot }, to: { cls: string; slot: GearSlot },
): string | null {
  if (from.cls === to.cls && from.slot === to.slot) return null;
  if (SLOT_KIND[from.slot] !== SLOT_KIND[to.slot]) return 'Wrong kind of slot';
  const id = gearInSlot(loadoutFor(cs, from.cls), from.slot);
  if (!id) return null;
  unequipToInventory(cs, from.cls, from.slot);
  return equipFromInventory(cs, to.cls, to.slot, id);
}

/** Multiset of the pieces a loadout holds, as `kind:id` keys - used to diff before/after a mission. */
function loadoutKeys(lo: UnitLoadout): string[] {
  return [lo.armor ? `armor:${lo.armor}` : null, ...lo.equipment.map((e) => (e ? `equipment:${e}` : null))]
    .filter((x): x is string => x !== null);
}

/**
 * Called once a campaign mission ends (13: a loss too): each surviving soldier keeps what they ended the
 * mission wearing - pieces they dropped or swapped go back to the locker, pieces they picked up are simply
 * theirs now. A soldier who died leaves their gear behind: recovered into the locker on a win (the squad
 * holds the field), lost on a loss.
 */
export function recordMissionGear(cs: CampaignState, units: EndedUnit[], won = true): void {
  for (const u of units) {
    if (u.team !== 'player') continue;
    const soldier = soldierOf(cs, u);
    if (!soldier) continue;
    const after = loadoutKeys({ armor: u.armor, equipment: [...u.equipment] });
    for (const key of loadoutKeys(soldier.loadout)) { // no longer carried: back on the shelf
      const i = after.indexOf(key);
      if (i >= 0) after.splice(i, 1);
      else { const [kind, id] = key.split(':'); addGear(cs.inventory, kind as GearKind, id); }
    }
    soldier.loadout = { armor: u.armor, equipment: [...u.equipment] };
    if (!u.alive) {
      if (won) for (const key of loadoutKeys(soldier.loadout)) { const [kind, id] = key.split(':'); addGear(cs.inventory, kind as GearKind, id); }
      soldier.loadout = emptyLoadout();
    }
  }
}

/**
 * Called alongside `recordMissionGear` once a campaign mission is won: each surviving soldier earns the XP
 * from their own final stat counters (see core/leveling.ts's `xpEarned`), resolving any level-up. The dead
 * earn nothing; they leave the roster in core/roster.ts's `afterMission` (13: permadeath is per soldier now).
 */
export function applyMissionXp(cs: CampaignState, units: EndedUnit[]): void {
  for (const u of units) {
    if (u.team !== 'player' || !u.alive) continue;
    const soldier = soldierOf(cs, u);
    if (soldier) gainXp(soldier.cls, soldier.progress, xpEarned(u));
  }
}

/** Toggles perk `id` equipped/unequipped for `cls`, or returns why it can't be equipped (unequipping never fails). */
export function togglePerk(cs: CampaignState, soldierId: string, id: PerkId): string | null {
  const soldier = soldierById(cs, soldierId);
  if (!soldier) return 'No such soldier';
  if (soldier.progress.equippedPerks.includes(id)) {
    unequipPerk(soldier.progress, id);
    return null;
  }
  return equipPerk(soldier.cls, soldier.progress, id);
}

/**
 * The equip screen addresses perks as indexed slots so they can be drag-and-drop targets, but
 * `ClassProgress.equippedPerks` stays a dense list (everything else - `perkBonus`, `createGame` - reads it
 * that way). These two translate: read the dense list into `slotCount` slots, write it back compacted.
 */
export function perkSlots(cs: CampaignState, soldierId: string): (PerkId | null)[] {
  const progress = progressFor(cs, soldierId);
  const cls = soldierById(cs, soldierId)?.cls ?? 'soldier';
  const slots: (PerkId | null)[] = Array.from({ length: slotCount(cls, progress.level) }, () => null);
  progress.equippedPerks.forEach((id, i) => { if (i < slots.length) slots[i] = id; });
  return slots;
}

/** Puts `id` (or nothing, to clear) in slot `index`, removing it from any slot it already occupied. */
export function setPerkSlot(cs: CampaignState, soldierId: string, index: number, id: PerkId | null): string | null {
  const progress = progressFor(cs, soldierId);
  if (id && !progress.perkPool.includes(id)) return 'Not unlocked yet';
  const slots = perkSlots(cs, soldierId);
  if (index < 0 || index >= slots.length) return 'No open perk slots';
  const next = slots.map((p) => (p === id ? null : p));
  next[index] = id;
  progress.equippedPerks = next.filter((p): p is PerkId => p !== null);
  return null;
}

/** A soldier's progress, mutable in place. An unknown id gets a throwaway fresh one. */
export function progressFor(cs: CampaignState, soldierId: string): ClassProgress {
  return soldierById(cs, soldierId)?.progress ?? newClassProgress();
}

/** Spends currency to build/upgrade a facility one level, or returns why it can't (nothing is charged then). */
export function upgradeFacility(cs: CampaignState, id: FacilityId): string | null {
  const cost = upgradeCost(cs.base, id);
  if (cost === null) return 'Already at max level';
  if (cs.currency < cost) return 'Not enough currency';
  cs.currency -= cost;
  buildLevel(cs.base, id);
  if (id === 'warRoom') fillPool(cs); // more offers show up at once
  if (id === 'recruitment') rollRecruits(cs); // and so do better candidates
  return null;
}

/** Which difficulty tier newly generated missions draw from - one step harder every 3 completed supply runs. */
function tierFor(cs: CampaignState): number {
  return Math.min(SUPPLY_RUN_PROFILE_TIERS.length - 1, Math.floor(cs.completedSupplyRuns / 3));
}

const pick = <T>(cs: CampaignState, list: readonly T[]): T => list[Math.floor(nextRandom(cs) * list.length)];

/**
 * Rolls one supply run: a hand-authored layout, a job name, an enemy profile from the current difficulty
 * tier, and a complication (weather / time of day / ammo scarcity) that pays extra for being worse. The
 * layout is drawn from the templates *not already in the pool* where possible, so the three offers on the
 * campaign screen are three different places rather than the same depot three times.
 */
function generateOne(cs: CampaignState): GeneratedMissionDef {
  const tier = tierFor(cs);
  const inPool = new Set(cs.supplyRunPool.map((m) => m.templateId));
  const choices = SUPPLY_RUN_TEMPLATES.filter((t) => !inPool.has(t.id));
  const template = pick(cs, choices.length ? choices : SUPPLY_RUN_TEMPLATES);
  const callsign = pick(cs, SUPPLY_RUN_CALLSIGNS);
  const complication = pick(cs, SUPPLY_RUN_COMPLICATIONS);
  const enemyProfile = pick(cs, SUPPLY_RUN_PROFILE_TIERS[tier]);
  const reward = Math.round((100 + tier * 60 + Math.floor(nextRandom(cs) * 60)) * complication.rewardMult);
  return {
    id: `supply-run-${cs.nextSupplyRunSeq++}`,
    templateId: template.id,
    complicationId: complication.id,
    name: `${callsign}: ${template.name}`,
    blurb: template.blurb,
    objective: template.objective,
    enemyProfile, tier, reward,
  };
}

/**
 * The playable map for a generated mission: its template's layout with the rolled enemy profile and
 * complication layered on. Rebuilt at launch rather than stored on the mission, so an edited map file reaches
 * a campaign that is already in progress.
 */
export function resolveSupplyRun(def: GeneratedMissionDef): MapDef {
  const template = supplyRunTemplate(def.templateId) ?? SUPPLY_RUN_TEMPLATES[0];
  const complication = supplyRunComplication(def.complicationId);
  return {
    ...template.map,
    name: template.name,
    enemyProfile: def.enemyProfile,
    ...(complication?.timeOfDay ? { startTimeOfDay: complication.timeOfDay } : {}),
    ...(complication?.weather ? { startWeather: complication.weather } : {}),
    ...(complication?.reserveMult ? { reserveMult: complication.reserveMult } : {}),
  };
}

/** How many supply runs are on offer at once: three, plus the war room's contacts (11). */
export const poolSize = (cs: CampaignState): number => POOL_SIZE + extraOffers(cs.base);

/** Tops the pool back up to `poolSize` after a completion (or on a fresh campaign). */
function fillPool(cs: CampaignState) {
  while (cs.supplyRunPool.length < poolSize(cs)) cs.supplyRunPool.push(generateOne(cs));
}

/**
 * Brings a loaded save forward: pool entries written before supply runs were template-based carry a baked-in
 * `map` and no `templateId`, so they are dropped and re-rolled rather than migrated. Losing three unplayed
 * offers is a far smaller cost than launching a mission whose stored map no longer matches anything.
 */
export function migrateCampaign(cs: CampaignState): CampaignState {
  // The base overhaul (11) added these; an older save starts with none of them.
  if (typeof cs.parts !== 'number') cs.parts = 0;
  if (!Array.isArray(cs.infirmary)) cs.infirmary = [];
  migrateRoster(cs);
  if (!cs.nextSoldierSeq) rollRecruits(cs); // a save from before hiring existed: open the office
  cs.supplyRunPool = cs.supplyRunPool.filter((m) => !!m.templateId && !!supplyRunTemplate(m.templateId));
  fillPool(cs);
  migrateGear(cs);
  return cs;
}

/**
 * Equipment used to be tracked as `unlockedGear`: a flat "ever found" list, with nothing consumed when a
 * piece was equipped. The locker (`inventory`) counts instead. A save from before that keeps everything it
 * had - one of each id it ever found - minus whatever is currently on a class, which is where those pieces
 * physically are.
 */
function migrateGear(cs: CampaignState): void {
  const legacy = (cs as unknown as { unlockedGear?: { armor?: ArmorId[]; equipment?: EquipmentId[] } }).unlockedGear;
  if (!cs.inventory) cs.inventory = newGearInventory();
  if (!legacy) return;
  for (const id of legacy.armor ?? []) addGear(cs.inventory, 'armor', id);
  for (const id of legacy.equipment ?? []) addGear(cs.inventory, 'equipment', id);
  for (const lo of cs.roster.map((s) => s.loadout)) {
    if (lo.armor) takeGear(cs.inventory, 'armor', lo.armor);
    for (const e of lo.equipment) if (e) takeGear(cs.inventory, 'equipment', e);
  }
  delete (cs as unknown as { unlockedGear?: unknown }).unlockedGear;
}

/**
 * Before the unit rework (13), gear, levels and wounds were kept per class. Those become the five founders:
 * each keeps their class's loadout, progress and HP, under the class id as their soldier id.
 */
function migrateRoster(cs: CampaignState): void {
  if (!Array.isArray(cs.recruits)) cs.recruits = [];
  if (typeof cs.nextSoldierSeq !== 'number') cs.nextSoldierSeq = 0;
  if (Array.isArray(cs.roster)) return;
  const old = cs as unknown as {
    loadouts?: Partial<Record<ClassId, UnitLoadout>>; levels?: Partial<Record<ClassId, ClassProgress>>; health?: Partial<Record<ClassId, number>>;
  };
  cs.roster = founders().map((s) => ({
    ...s,
    loadout: old.loadouts?.[s.cls] ?? s.loadout,
    progress: old.levels?.[s.cls] ?? s.progress,
    ...(old.health?.[s.cls] !== undefined ? { hp: old.health[s.cls] } : {}),
  }));
  delete old.loadouts; delete old.levels; delete old.health;
}

/** Districts that are unlocked but whose briefing has not been shown yet, in play order. */
export function unseenIntros(cs: CampaignState): string[] {
  if (!cs.seenIntros) cs.seenIntros = [];
  return DISTRICT_ORDER.filter((id) => cs.unlockedDistricts.includes(id) && !cs.seenIntros.includes(id));
}

export function markIntroSeen(cs: CampaignState, districtId: string): void {
  if (!cs.seenIntros) cs.seenIntros = [];
  if (!cs.seenIntros.includes(districtId)) cs.seenIntros.push(districtId);
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
  cs.parts += STORY_PARTS;
  if (districtStatus(cs, m.district) !== 'completed') return;
  const next = DISTRICT_ORDER[DISTRICT_ORDER.indexOf(m.district) + 1];
  if (next && !cs.unlockedDistricts.includes(next)) cs.unlockedDistricts.push(next);
}

/** Marks a generated mission won: banks its reward, retires it, and regenerates the pool back up to size. */
export function completeSupplyRun(cs: CampaignState, missionId: string): void {
  const i = cs.supplyRunPool.findIndex((m) => m.id === missionId);
  if (i < 0) return;
  cs.currency += cs.supplyRunPool[i].reward;
  cs.parts += supplyRunParts(cs.supplyRunPool[i].tier);
  cs.supplyRunPool.splice(i, 1);
  cs.completedSupplyRuns++;
  fillPool(cs);
}
