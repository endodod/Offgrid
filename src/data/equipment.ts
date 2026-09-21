/**
 * Equipment pieces (7): fill either of a unit's two equipment slots. Each counters a specific environmental
 * penalty (weather or time-of-day, never the other - see core/environment.ts's `effectiveVision`/
 * `effectiveAccuracyMod`) or grants a flat move bonus, rather than being a new kind of stat.
 */
export type EquipmentId = 'boots' | 'flashlight' | 'nvg';
export const EQUIPMENT_ORDER: EquipmentId[] = ['boots', 'flashlight', 'nvg'];

export interface EquipmentDef {
  name: string;
  blurb: string;
  moveBonus?: number; // boots: flat tiles added after every other move modifier
  weatherVisionCounter?: number; // flashlight: fraction (0..1) of weather's vision penalty canceled
  timeCounter?: number; // nvg: fraction (0..1) of time-of-day's vision AND accuracy penalty canceled
}

export const EQUIPMENT: Record<EquipmentId, EquipmentDef> = {
  boots: { name: 'Boots', blurb: '+1 move range, every mission.', moveBonus: 1 },
  flashlight: { name: 'Flashlight', blurb: "Cuts weather's vision penalty (rain, fog) in half. Time of day unaffected.", weatherVisionCounter: 0.5 },
  nvg: { name: 'Night-Vision Goggles', blurb: "Cuts time-of-day's vision and accuracy penalty (midnight) in half. Weather unaffected.", timeCounter: 0.5 },
};
