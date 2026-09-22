import type { MapDef } from '../trainingGrounds';
import { LIGHTS_OUT } from './lightsOut';
import { SIGNAL_FIRE } from './signalFire';
import { MARKET_ROW } from './marketRow';
import { JACKALS_DEN } from './jackalsDen';
import { FUEL_DEPOT, PHARMACY_ROW, RAIL_YARD, UNDERPASS, WATERWORKS } from './supplyMaps';

export { LIGHTS_OUT, SIGNAL_FIRE, MARKET_ROW, JACKALS_DEN };
export { FUEL_DEPOT, PHARMACY_ROW, RAIL_YARD, UNDERPASS, WATERWORKS };

/** Every hand-authored campaign map, for the shared validation test in `src/data/maps.test.ts`. */
export const ALL_AUTHORED_MAPS: MapDef[] = [
  LIGHTS_OUT, SIGNAL_FIRE, MARKET_ROW, JACKALS_DEN,
  FUEL_DEPOT, PHARMACY_ROW, RAIL_YARD, UNDERPASS, WATERWORKS,
];
