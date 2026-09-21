import { TIMES_OF_DAY } from '../data/timeOfDay';
import { WEATHERS, type EnvModifier } from '../data/weather';
import type { GameState } from './types';

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
