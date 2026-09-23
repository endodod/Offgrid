import { PATCH_SHARE } from '../data/base';
import { ARMOR } from '../data/armor';
import { EQUIPMENT } from '../data/equipment';
import type { MapDef } from '../data/trainingGrounds';
import { CLASSES, CLASS_ORDER, type ClassId } from '../data/units';
import { infirmaryBeds, infirmaryHeal, restRate, trainingXp } from './base';
import { progressFor, type CampaignState } from './campaign';
import { trimLocker } from './crafting';
import { gainXp } from './leveling';

/**
 * The squad between missions (11). A campaign soldier keeps the HP they ended a mission on. Time passes one
 * mission at a time: whoever deployed gets patched up a little, whoever sat it out rests (the barracks), and
 * whoever was in an infirmary bed heals a lot. The player picks who deploys on the briefing screen.
 *
 * Only a won mission advances the campaign. A loss is retried from where it started, so it changes no one's
 * health: the same rule the campaign already uses for gear and XP.
 */

export const maxHp = (cls: ClassId): number => CLASSES[cls].hp;
export const currentHp = (cs: CampaignState, cls: ClassId): number => Math.min(maxHp(cls), cs.health[cls] ?? maxHp(cls));
export const inInfirmary = (cs: CampaignState, cls: ClassId): boolean => cs.infirmary.includes(cls);

export type SoldierStatus = 'ready' | 'wounded' | 'infirmary';
export function soldierStatus(cs: CampaignState, cls: ClassId): SoldierStatus {
  if (inInfirmary(cs, cls)) return 'infirmary';
  return currentHp(cs, cls) < maxHp(cls) ? 'wounded' : 'ready';
}

/** Puts `cls` in a bed. Returns why not if there's no free bed or they're not hurt. */
export function admit(cs: CampaignState, cls: ClassId): string | null {
  if (inInfirmary(cs, cls)) return null;
  const beds = infirmaryBeds(cs.base);
  if (!beds) return 'Build the infirmary first';
  if (currentHp(cs, cls) >= maxHp(cls)) return 'Not wounded';
  if (cs.infirmary.length >= beds) return 'Every bed is taken';
  cs.infirmary.push(cls);
  return null;
}

export function discharge(cs: CampaignState, cls: ClassId): void {
  cs.infirmary = cs.infirmary.filter((c) => c !== cls);
}

/** Who the briefing screen ticks by default: everyone not in a bed. */
export const defaultSquad = (cs: CampaignState): ClassId[] => CLASS_ORDER.filter((c) => !inInfirmary(cs, c));

/**
 * The map as the chosen squad plays it: player spawns for anyone not deploying are dropped, and each
 * deploying soldier starts on their carried-over HP. Anyone in a bed who deploys anyway leaves the bed.
 */
export function deploySquad(cs: CampaignState, map: MapDef, squad: ClassId[]): MapDef {
  for (const c of squad) discharge(cs, c);
  const startingHp: Partial<Record<ClassId, number>> = {};
  for (const c of squad) startingHp[c] = currentHp(cs, c);
  return {
    ...map,
    spawns: { ...map.spawns, player: map.spawns.player.filter(([cls]) => squad.includes(cls)) },
    startingHp,
  };
}

/** The minimal shape of a mission's ending unit this module needs (core/types.ts `Unit` fits). */
interface EndedUnit { team: 'player' | 'enemy'; cls: ClassId; hp: number; alive: boolean; downed: boolean }

/** What happened at the base after a mission, for the after-action modal. */
export interface AfterAction {
  lines: string[];
}

/**
 * Called once per won campaign mission, after gear and XP are recorded. The player units in `units` are
 * the ones that deployed; everyone else sat it out. Order matters: set everyone's HP from the mission first, then let time pass, then drills, then the
 * locker, so the report reads in the order things happened.
 */
export function afterMission(cs: CampaignState, units: EndedUnit[]): AfterAction {
  const lines: string[] = [];
  const mine = units.filter((u) => u.team === 'player');
  const deployed = new Set(mine.map((u) => u.cls));
  // 1. HP from the mission. A downed survivor comes home on 1 HP; the fallen are replaced at full strength
  //    (their class has already been reset to level 1 by applyMissionXp).
  for (const u of mine) {
    if (!u.alive) { delete cs.health[u.cls]; discharge(cs, u.cls); lines.push(`${CLASSES[u.cls].name} was killed. A replacement joins at full strength.`); }
    else cs.health[u.cls] = Math.max(1, u.downed ? 1 : u.hp);
  }
  // 2. Time passes.
  const rest = restRate(cs.base);
  const bed = infirmaryHeal(cs.base);
  for (const cls of CLASS_ORDER) {
    const before = currentHp(cs, cls);
    const max = maxHp(cls);
    if (before >= max) { delete cs.health[cls]; continue; } // includes the fallen, cleared above
    const where = inInfirmary(cs, cls) ? 'infirmary' : deployed.has(cls) ? 'field' : 'rest';
    const share = where === 'infirmary' ? bed : where === 'rest' ? rest : rest * PATCH_SHARE;
    const after = Math.min(max, before + Math.max(1, Math.round(max * share)));
    if (after >= max) delete cs.health[cls];
    else cs.health[cls] = after;
    const how = where === 'infirmary' ? 'in the infirmary' : where === 'rest' ? 'resting' : 'patched up';
    lines.push(`${CLASSES[cls].name} ${how}: ${before} → ${after}/${max} HP${after >= max && where === 'infirmary' ? ', discharged' : ''}.`);
    if (after >= max) discharge(cs, cls);
  }
  // 3. Drills for whoever stayed home.
  const drill = trainingXp(cs.base);
  if (drill) {
    const benched = CLASS_ORDER.filter((c) => !deployed.has(c));
    for (const cls of benched) gainXp(cls, progressFor(cs, cls), drill);
    if (benched.length) lines.push(`Training room: ${benched.map((c) => CLASSES[c].name).join(', ')} +${drill} XP.`);
  }
  // 4. The locker.
  for (const s of trimLocker(cs)) {
    const name = s.kind === 'armor' ? ARMOR[s.id as keyof typeof ARMOR].name : EQUIPMENT[s.id as keyof typeof EQUIPMENT].name;
    lines.push(`Locker full: scrapped ${name} for ${s.parts} parts.`);
  }
  return { lines };
}
