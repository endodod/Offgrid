import type { EnvModifier } from './weather';

export type TimeOfDayId = 'midday' | 'morning' | 'afternoon' | 'midnight';
export const TIME_ORDER: TimeOfDayId[] = ['morning', 'midday', 'afternoon', 'midnight'];

export interface TimeOfDayDef extends EnvModifier {
  name: string;
  blurb: string;
}

// Placeholder numbers - tweak freely. Midday is the neutral baseline (full daylight, no penalties).
export const TIMES_OF_DAY: Record<TimeOfDayId, TimeOfDayDef> = {
  midday:    { name: 'Midday',    visionMult: 1,    accuracyMod: 0,   moveMult: 1,    blurb: 'Full daylight. No penalties.' },
  morning:   { name: 'Morning',   visionMult: 0.85, accuracyMod: -5,  moveMult: 1,    blurb: 'Low sun and haze reduce sight a little.' },
  afternoon: { name: 'Afternoon', visionMult: 1,    accuracyMod: -5,  moveMult: 1,    blurb: 'Bright, but glare off the sun costs a little accuracy.' },
  midnight:  { name: 'Midnight',  visionMult: 0.5,  accuracyMod: -20, moveMult: 0.85, blurb: 'Darkness: vision roughly halved, big accuracy hit, careful movement.' },
};
