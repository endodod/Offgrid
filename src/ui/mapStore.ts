import { parseMap, serializeMap } from '../core/mapFormat';
import type { MapDef } from '../data/trainingGrounds';

const key = (missionId: string) => `offgrid.map.${missionId}`;

/** A map saved from the builder, or null (nothing saved, storage unavailable, or the data no longer validates). */
export function loadCustom(missionId: string, base: MapDef): MapDef | null {
  try {
    const raw = localStorage.getItem(key(missionId));
    return raw ? parseMap(JSON.parse(raw), base) : null;
  } catch {
    return null;
  }
}

export function saveCustom(missionId: string, map: MapDef): boolean {
  try {
    localStorage.setItem(key(missionId), serializeMap(map));
    return true;
  } catch {
    return false;
  }
}

export function clearCustom(missionId: string) {
  try {
    localStorage.removeItem(key(missionId));
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
