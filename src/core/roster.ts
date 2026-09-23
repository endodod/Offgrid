import { HIRE_COST, PATCH_SHARE } from '../data/base';
import { ARMOR } from '../data/armor';
import { EQUIPMENT } from '../data/equipment';
import type { MapDef } from '../data/trainingGrounds';
import { CLASSES, type ClassId } from '../data/units';
import { infirmaryBeds, infirmaryHeal, restRate, rosterCapacity, trainingXp } from './base';
import { addGear, rollRecruits, soldierById, type CampaignState, type Soldier } from './campaign';
import { trimLocker } from './crafting';
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

export type SoldierStatus = 'ready' | 'wounded' | 'infirmary';
export function soldierStatus(cs: CampaignState, s: Soldier): SoldierStatus {
  if (inInfirmary(cs, s.id)) return 'infirmary';
  return soldierHp(s) < maxHp(s.cls) ? 'wounded' : 'ready';
}

/** Puts soldier `id` in a bed. Returns why not if there's no free bed or they're not hurt. */
export function admit(cs: CampaignState, id: string): string | null {
  const s = soldierById(cs, id);
  if (!s) return 'No such soldier';
  if (inInfirmary(cs, id)) return null;
  const beds = infirmaryBeds(cs.base);
  if (!beds) return 'Build the infirmary first';
  if (soldierHp(s) >= maxHp(s.cls)) return 'Not wounded';
  if (cs.infirmary.length >= beds) return 'Every bed is taken';
  cs.infirmary.push(id);
  return null;
}

export function discharge(cs: CampaignState, id: string): void {
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
  if (cs.roster.length <= 1) return 'The squad needs at least one soldier';
  if (s.loadout.armor) addGear(cs.inventory, 'armor', s.loadout.armor);
  for (const e of s.loadout.equipment) if (e) addGear(cs.inventory, 'equipment', e);
  discharge(cs, id);
  cs.roster = cs.roster.filter((r) => r !== s);
  return null;
}

// ---------- after a mission ----------

/** The minimal shape of a mission's ending unit this module needs (core/types.ts `Unit` fits). */
interface EndedUnit { team: 'player' | 'enemy'; cls: ClassId; hp: number; alive: boolean; downed: boolean; soldierId?: string }

/** What happened at the base after a mission, for the after-action modal. */
export interface AfterAction {
  lines: string[];
}

/** How many volunteers turn up if the whole roster is lost, so a campaign can never be stranded. */
const VOLUNTEERS = 2;

/**
 * Called once per campaign mission that ended - won or lost (13) - after gear and XP are recorded. The
 * player units in `units` are the ones that deployed; everyone else sat it out. Order matters: HP from the
 * mission first (and the fallen leave the roster), then time passes, then drills, the locker and new
 * candidates, so the report reads in the order things happened.
 */
export function afterMission(cs: CampaignState, units: EndedUnit[], won = true): AfterAction {
  const lines: string[] = won ? [] : ['The squad pulled back. The mission is still open, but time has passed.'];
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
  // 4. The locker.
  for (const g of trimLocker(cs)) {
    const name = g.kind === 'armor' ? ARMOR[g.id as keyof typeof ARMOR].name : EQUIPMENT[g.id as keyof typeof EQUIPMENT].name;
    lines.push(`Locker full: scrapped ${name} for ${g.parts} parts.`);
  }
  // 5. New candidates, and volunteers if nobody is left.
  rollRecruits(cs);
  if (!cs.roster.length) {
    for (const r of cs.recruits.splice(0, VOLUNTEERS)) cs.roster.push(r);
    lines.push(`With the squad gone, ${cs.roster.map((s) => s.name).join(' and ')} step up to carry on.`);
  }
  if (cs.recruits.length) lines.push(`${cs.recruits.length} new candidates at the recruitment office.`);
  return { lines };
}
