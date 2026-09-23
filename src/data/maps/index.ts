import type { MapDef } from '../trainingGrounds';
import { LIGHTS_OUT } from './story/lightsOut';
import { SIGNAL_FIRE } from './story/signalFire';
import { COLD_STORAGE } from './story/coldStorage';
import { PUMPHOUSE } from './story/pumphouse';
import { TOLLGATE } from './story/tollgate';
import { MARKET_ROW } from './story/marketRow';
import { THE_CLINIC } from './story/theClinic';
import { ROW_RELAY } from './story/rowRelay';
import { NIGHT_MARKET } from './story/nightMarket';
import { JACKALS_DEN } from './story/jackalsDen';
import { CANAL_TOWPATH, CORNER_STORE, FUEL_DEPOT, PARKING_DECK, PHARMACY_ROW, RAIL_YARD, UNDERPASS, WATERWORKS } from './supplyMaps';

export { LIGHTS_OUT, SIGNAL_FIRE, COLD_STORAGE, PUMPHOUSE, TOLLGATE };
export { MARKET_ROW, THE_CLINIC, ROW_RELAY, NIGHT_MARKET, JACKALS_DEN };
export { FUEL_DEPOT, PHARMACY_ROW, RAIL_YARD, UNDERPASS, WATERWORKS, CORNER_STORE, CANAL_TOWPATH, PARKING_DECK };

/** Every hand-authored campaign map, for the shared validation test in `src/data/maps.test.ts`. */
export const ALL_AUTHORED_MAPS: MapDef[] = [
  LIGHTS_OUT, SIGNAL_FIRE, COLD_STORAGE, PUMPHOUSE, TOLLGATE,
  MARKET_ROW, THE_CLINIC, ROW_RELAY, NIGHT_MARKET, JACKALS_DEN,
  FUEL_DEPOT, PHARMACY_ROW, RAIL_YARD, UNDERPASS, WATERWORKS, CORNER_STORE, CANAL_TOWPATH, PARKING_DECK,
];
