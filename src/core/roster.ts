import { HIRE_COST, PATCH_SHARE } from '../data/base';
import type { MapDef } from '../data/trainingGrounds';
import { CLASSES, type ClassId } from '../data/units';
import { LEVEL_PATHS } from '../data/leveling';
import { infirmaryBeds, infirmaryHeal, restRate, rosterCapacity, trainingXp } from './base';
import {
  addGear, applyMissionXp, completeStoryMission, completeSupplyRun, onMission, recordMissionGear, rollRecruits,
  soldierById, withdrawSupplyRun, type CampaignState, type Soldier,
} from './campaign';
import { lockerCount } from './crafting';
import { lockerCapacity } from './base';
import type { ArmorId } from '../data/armor';
import type { EquipmentId } from '../data/equipment';
import { gainXp } from './leveling';

/**
 * The squad between missions (11, reworked per soldier in 13). Every soldier keeps the HP they ended a mission
 * on. Each campaign mission played - won or lost - is one step of time: whoever deployed and came back gets
 * patched up, whoever sat it out rests (the barracks), whoever was in an infirmary bed heals a lot, and the
 * recruitment office has a fresh set of candidates. The player picks who deploys on the briefing screen.
 */

export const maxHp = (cls: ClassId): number => CLASSES[cls].hp;
export const soldierHp = (s: Soldier): number => Math.min(maxHp(s.cls), s.hp ?? maxHp(s.cls));
export const inInfirmary = (cs: CampaignState, id: string): boolean => cs.infirmary.includes(id);
/** "Mara Quill" -> "Mara"; the log and HUD use the short form. */
export const shortName = (s: { name: string }): string => s.name.split(' ')[0];

export type SoldierStatus = 'ready' | 'wounded' | 'infirmary' | 'away';
export function soldierStatus(cs: CampaignState, s: Soldier): SoldierStatus {
  if (onMission(cs, s.id)) return 'away';
  if (inInfirmary(cs, s.id)) return 'infirmary';
  return soldierHp(s) < maxHp(s.cls) ? 'wounded' : 'ready';
}

/** Puts soldier `id` in a bed. Returns why not if there's no free bed or they're not hurt. */
export function admit(cs: CampaignState, id: string): string | null {
  const s = soldierById(cs, id);
  if (!s) return 'No such soldier';
  if (onMission(cs, id)) return 'Away on a mission';
  if (inInfirmary(cs, id)) return null;
  const beds = infirmaryBeds(cs.base);
  if (!beds) return 'Build the infirmary first';
  if (soldierHp(s) >= maxHp(s.cls)) return 'Not wounded';
  if (cs.infirmary.length >= beds) return 'Every bed is taken';
  cs.infirmary.push(id);
  return null;
}

export function discharge(cs: CampaignState, id: string): void {
  if (onMission(cs, id)) return;
  cs.infirmary = cs.infirmary.filter((c) => c !== id);
}

/**
 * Who the briefing screen ticks by default for a mission with `slots` spawn tiles: nobody in a bed, the
 * healthy before the badly hurt, then the highest level.
 */
export function defaultSquad(cs: CampaignState, slots: number): string[] {
  const hurt = (s: Soldier) => (soldierHp(s) / maxHp(s.cls) < 0.5 ? 1 : 0);
  return cs.roster
    .filter((s) => !inInfirmary(cs, s.id))
    .sort((a, b) => hurt(a) - hurt(b) || b.progress.level - a.progress.level || b.progress.xp - a.progress.xp)
    .slice(0, slots)
    .map((s) => s.id);
}

/**
 * The map as the chosen squad plays it: each soldier takes one of the map's player spawn tiles in order,
 * carrying their own class, gear, progress and HP (`MapDef.squad`). Anyone in a bed who deploys leaves it.
 */
export function deploySquad(cs: CampaignState, map: MapDef, ids: string[]): MapDef {
  const squad = ids.map((id) => soldierById(cs, id)).filter((s): s is Soldier => !!s).slice(0, map.spawns.player.length);
  for (const s of squad) discharge(cs, s.id);
  cs.deployed = squad.map((s) => s.id);
  return {
    ...map,
    spawns: { ...map.spawns, player: map.spawns.player.slice(0, squad.length) },
    squad: squad.map((s) => ({
      soldierId: s.id, name: s.name, cls: s.cls,
      loadout: { armor: s.loadout.armor, equipment: [...s.loadout.equipment] },
      progress: { ...s.progress, perkPool: [...s.progress.perkPool], equippedPerks: [...s.progress.equippedPerks] },
      ...(s.hp !== undefined ? { hp: soldierHp(s) } : {}),
    })),
  };
}

// ---------- hiring (13) ----------

/** What hiring `s` costs: the base fee, plus a little for any experience they arrive with. */
export const hireCost = (s: Soldier): number => HIRE_COST + Math.round(s.progress.xp / 5);

/** Hires candidate `id` onto the roster. Returns why not (and changes nothing) if they can't be hired. */
export function hire(cs: CampaignState, id: string): string | null {
  const s = cs.recruits.find((r) => r.id === id);
  if (!s) return 'No such candidate';
  if (cs.roster.length >= rosterCapacity(cs.base)) return 'The barracks are full';
  const cost = hireCost(s);
  if (cs.currency < cost) return 'Not enough salvage';
  cs.currency -= cost;
  cs.recruits = cs.recruits.filter((r) => r !== s);
  cs.roster.push(s);
  return null;
}

/** Lets soldier `id` go. Their gear goes back to the locker. The last soldier can't be dismissed. */
export function dismiss(cs: CampaignState, id: string): string | null {
  const s = soldierById(cs, id);
  if (!s) return 'No such soldier';
  if (onMission(cs, id)) return 'Away on a mission';
  if (cs.roster.length <= 1) return 'The squad needs at least one soldier';
  if (s.loadout.armor) addGear(cs.inventory, 'armor', s.loadout.armor);
  for (const e of s.loadout.equipment) if (e) addGear(cs.inventory, 'equipment', e);
  discharge(cs, id);
  cs.roster = cs.roster.filter((r) => r !== s);
  return null;
}

// ---------- after a mission ----------

/** The minimal shape of a mission's ending unit this module needs (core/types.ts `Unit` fits). */
interface EndedUnit {
  team: 'player' | 'enemy'; cls: ClassId; hp: number; alive: boolean; downed: boolean; soldierId?: string;
  armor: ArmorId | null; equipment: [EquipmentId | null, EquipmentId | null]; dmgDealt: number; kills: number; revives: number;
}

/** How a campaign mission ended. A retreat is a loss the player chose (the Menu button mid-mission). */
export type MissionOutcome = 'won' | 'lost' | 'retreat';

/** Salvage an evacuation costs. Without it, retreating on turn 1 would be a free way to pass time (healing,
 *  training, new candidates). Never takes the campaign below zero. */
export const RETREAT_FEE = 40;

/**
 * Everything a finished campaign mission does to the campaign (13, 14), in order. A win completes the mission
 * (reward, parts, story progress) and pays XP. A loss or retreat completes nothing; a supply run is withdrawn
 * from the board, and a retreat also pays the evacuation fee. Either way survivors keep what they carried out,
 * the fallen are gone and one mission's worth of time passes. Returns the after-action lines.
 */
export function endMission(cs: CampaignState, missionId: string, units: EndedUnit[], outcome: MissionOutcome): string[] {
  const won = outcome === 'won';
  const partsBefore = cs.parts;
  const lines: string[] = [];
  const isSupplyRun = cs.supplyRunPool.some((m) => m.id === missionId);
  if (won) {
    if (isSupplyRun) completeSupplyRun(cs, missionId);
    else { completeStoryMission(cs, missionId); cs.inbox = { ...cs.inbox, debrief: missionId }; }
  } else {
    lines.push(outcome === 'retreat'
      ? 'The squad retreated. Nothing was gained, and time has passed.'
      : 'The mission failed. Nothing was gained, and time has passed.');
    if (outcome === 'retreat') {
      const fee = Math.min(cs.currency, RETREAT_FEE);
      cs.currency -= fee;
      if (fee) lines.push(`The evacuation cost ${fee} salvage.`);
    }
    if (isSupplyRun) { withdrawSupplyRun(cs, missionId); lines.push('The client has found someone else: the job is off the board.'); }
  }
  cs.deployed = undefined; // back (or not): the roster is theirs to manage again
  recordMissionGear(cs, units, won);
  if (won) applyMissionXp(cs, units);
  if (cs.parts > partsBefore) lines.push(`Salvaged ${cs.parts - partsBefore} parts for the fabricator.`);
  lines.push(...afterMission(cs, units).lines);
  const over = lockerCount(cs.inventory) - lockerCapacity(cs.base);
  if (over > 0) lines.push(`The locker is ${over} over capacity. Scrap or equip gear before the next deployment.`);
  return lines;
}

/** What happened at the base after a mission, for the after-action modal. */
export interface AfterAction {
  lines: string[];
}

/** How many volunteers turn up if the whole roster is lost, so a campaign can never be stranded. */
const VOLUNTEERS = 2;

/**
 * One mission's worth of time at the base (11, 13), won or lost - called by `endMission` after gear and XP. The
 * player units in `units` are the ones that deployed; everyone else sat it out. Order matters: HP from the
 * mission first (and the fallen leave the roster), then time passes, then drills and new candidates, so the
 * report reads in the order things happened. The locker is not touched: over capacity, the player chooses what
 * goes (the Locker screen, ui/stash.ts), and the campaign won't deploy until they have.
 */
export function afterMission(cs: CampaignState, units: Pick<EndedUnit, 'team' | 'cls' | 'hp' | 'alive' | 'downed' | 'soldierId'>[]): AfterAction {
  const lines: string[] = [];
  const mine = units.filter((u) => u.team === 'player');
  const deployed = new Set<string>();
  // 1. HP from the mission. A downed survivor comes home on 1 HP; the fallen are gone for good.
  for (const u of mine) {
    const s = soldierById(cs, u.soldierId ?? u.cls);
    if (!s) continue;
    deployed.add(s.id);
    if (!u.alive) {
      discharge(cs, s.id);
      cs.roster = cs.roster.filter((r) => r !== s);
      lines.push(`${s.name} (${CLASSES[s.cls].name}, level ${s.progress.level}) was killed in action.`);
    } else s.hp = Math.max(1, u.downed ? 1 : u.hp);
  }
  // 2. Time passes.
  const rest = restRate(cs.base);
  const bed = infirmaryHeal(cs.base);
  for (const s of cs.roster) {
    const before = soldierHp(s);
    const max = maxHp(s.cls);
    if (before >= max) { delete s.hp; continue; }
    const where = inInfirmary(cs, s.id) ? 'infirmary' : deployed.has(s.id) ? 'field' : 'rest';
    const share = where === 'infirmary' ? bed : where === 'rest' ? rest : rest * PATCH_SHARE;
    const after = Math.min(max, before + Math.max(1, Math.round(max * share)));
    if (after >= max) delete s.hp;
    else s.hp = after;
    const how = where === 'infirmary' ? 'in the infirmary' : where === 'rest' ? 'resting' : 'patched up';
    lines.push(`${s.name} ${how}: ${before} → ${after}/${max} HP${after >= max && where === 'infirmary' ? ', discharged' : ''}.`);
    if (after >= max) discharge(cs, s.id);
  }
  // 3. Drills for whoever stayed home.
  const drill = trainingXp(cs.base);
  const benched = cs.roster.filter((s) => !deployed.has(s.id));
  if (drill && benched.length) {
    for (const s of benched) gainXp(s.cls, s.progress, drill);
    lines.push(`Training room: ${benched.map(shortName).join(', ')} +${drill} XP.`);
  }
  // 4. New candidates, and volunteers if nobody is left.
  rollRecruits(cs);
  if (!cs.roster.length) {
    for (const r of cs.recruits.splice(0, VOLUNTEERS)) cs.roster.push(r);
    lines.push(`With the squad gone, ${cs.roster.map((s) => s.name).join(' and ')} step up to carry on.`);
  }
  if (cs.recruits.length) lines.push(`${cs.recruits.length} new candidates at the recruitment office.`);
  return { lines };
}

// ---------- debug (VITE_DEBUG only, see ui/base.ts) ----------

/** Sets a soldier's carried-over HP, clamped to 1..max (full clears it). */
export function debugSetHp(cs: CampaignState, id: string, hp: number): void {
  const s = soldierById(cs, id);
  if (!s || !Number.isFinite(hp)) return;
  const v = Math.max(1, Math.min(maxHp(s.cls), Math.round(hp)));
  if (v >= maxHp(s.cls)) delete s.hp;
  else s.hp = v;
}

/** Gives a soldier `xp` (levels and perks resolve as usual), or with `xp` = 'level' exactly enough for the next level. */
export function debugGiveXp(cs: CampaignState, id: string, xp: number | 'level'): void {
  const s = soldierById(cs, id);
  if (!s) return;
  const amount = xp === 'level' ? (LEVEL_PATHS[s.cls].find((d) => d.xpThreshold > s.progress.xp)?.xpThreshold ?? s.progress.xp) - s.progress.xp : xp;
  if (amount > 0) gainXp(s.cls, s.progress, amount);
}
