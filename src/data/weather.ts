/** Shared shape for anything that scales vision, accuracy or move range. Placeholder numbers - tweak freely. */
export interface EnvModifier {
  visionMult: number; // scales every unit's vision range
  accuracyMod: number; // percentage points added to hit chance
  moveMult: number; // scales every unit's move range
}

export type WeatherId = 'clear' | 'cloudy' | 'rain' | 'fog' | 'stormy';
export const WEATHER_ORDER: WeatherId[] = ['clear', 'cloudy', 'rain', 'fog', 'stormy'];

export interface WeatherDef extends EnvModifier {
  name: string;
  blurb: string;
}

export const WEATHERS: Record<WeatherId, WeatherDef> = {
  clear:  { name: 'Clear',  visionMult: 1,    accuracyMod: 0,   moveMult: 1,    blurb: 'No weather effects.' },
  cloudy: { name: 'Cloudy', visionMult: 0.95, accuracyMod: 0,   moveMult: 1,    blurb: 'Duller light. Barely noticeable.' },
  rain:   { name: 'Rain',   visionMult: 0.8,  accuracyMod: -10, moveMult: 0.9,  blurb: 'Wet ground slows movement; rain blurs sight and aim.' },
  fog:    { name: 'Fog',    visionMult: 0.5,  accuracyMod: -5,  moveMult: 1,    blurb: 'Vision cut hard; movement and aim mostly unaffected.' },
  stormy: { name: 'Storm',  visionMult: 0.65, accuracyMod: -20, moveMult: 0.75, blurb: 'Wind and rain: heavy accuracy and movement penalty.' },
};
