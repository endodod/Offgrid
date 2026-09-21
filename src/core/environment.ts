import { CLASSES } from '../data/units';
import { TIMES_OF_DAY } from '../data/timeOfDay';
import { WEATHERS, type EnvModifier } from '../data/weather';
import { EQUIPMENT, type EquipmentDef } from '../data/equipment';
import type { GameState, Unit } from './types';

/** Combined effect of the current time of day and weather. Multipliers multiply, accuracy modifiers add. */
export function envMods(s: GameState): EnvModifier {
  const t = TIMES_OF_DAY[s.timeOfDay];
  const w = WEATHERS[s.weather];
  return {
    visionMult: t.visionMult * w.visionMult,
    accuracyMod: t.accuracyMod + w.accuracyMod,
    moveMult: t.moveMult * w.moveMult,
  };
}

/** A unit's vision radius after time-of-day/weather, floored so a unit is never fully blind. */
export const scaledVision = (s: GameState, base: number): number => Math.max(1, Math.round(base * envMods(s).visionMult));

/** A unit's move range after time-of-day/weather (before any per-move bonus like adrenaline), floored to at least 1. */
export const scaledMove = (s: GameState, base: number): number => Math.max(1, Math.round(base * envMods(s).moveMult));

const equippedItems = (u: Unit): EquipmentDef[] => u.equipment.filter((id): id is NonNullable<typeof id> => !!id).map((id) => EQUIPMENT[id]);

/** Every weather/time-of-day multiplier here is <= 1 (a penalty or neutral, never a bonus - see data/weather.ts
 *  and data/timeOfDay.ts), so "counter a fraction of it" always means blending that multiplier back toward 1. */
const blendTowardOne = (mult: number, strength: number): number => mult + (1 - mult) * strength;

/**
 * `u`'s vision radius after weather, time of day, AND its own equipped items (7) - a flashlight blunts
 * weather's vision penalty specifically, NVG blunts time-of-day's specifically, each independent of the
 * other (so both together fully address a stormy midnight; either alone only helps with its own half).
 */
export function effectiveVision(s: GameState, u: Unit): number {
  const t = TIMES_OF_DAY[s.timeOfDay];
  const w = WEATHERS[s.weather];
  const items = equippedItems(u);
  const timeCounter = Math.max(0, ...items.map((e) => e.timeCounter ?? 0));
  const weatherCounter = Math.max(0, ...items.map((e) => e.weatherVisionCounter ?? 0));
  const mult = blendTowardOne(t.visionMult, timeCounter) * blendTowardOne(w.visionMult, weatherCounter);
  return Math.max(1, Math.round(CLASSES[u.cls].vision * mult));
}

/** `u`'s move range after weather/time of day and its own equipment's flat bonus (e.g. boots), floored to at least 1. */
export function effectiveMove(s: GameState, u: Unit): number {
  const moveBonus = equippedItems(u).reduce((sum, e) => sum + (e.moveBonus ?? 0), 0);
  return scaledMove(s, CLASSES[u.cls].move) + moveBonus;
}

/** `attacker`'s accuracy modifier (percentage points) after weather/time of day and NVG's time-of-day counter. */
export function effectiveAccuracyMod(s: GameState, attacker: Unit): number {
  const t = TIMES_OF_DAY[s.timeOfDay];
  const w = WEATHERS[s.weather];
  const timeCounter = Math.max(0, ...equippedItems(attacker).map((e) => e.timeCounter ?? 0));
  return t.accuracyMod * (1 - timeCounter) + w.accuracyMod;
}
