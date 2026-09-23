import { building, field, hRun, pts, put, rect, stamp, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 3 of 5 - "Cold Storage". Objective: `reach`, 3 units to the dock. 46x22 (19: a long,
 * low building - the squad walks the length of it).
 *
 * The first properly indoor map: a meat-packing plant, west to east, four halls deep. Every hall is divided
 * from the next by a solid wall with exactly two roller doors in it, one up and one down. A closed door blocks
 * sight as well as feet, so the down door in each wall is a route nobody is watching - until somebody opens it.
 * Since 10j the Jackals open doors too; a door is a decision for both sides, and the side that opens one first
 * picks where the next fight happens.
 *
 * Freezer racks run north-south, not east-west, so the aisles point across the line of advance instead of
 * along it: there is no long shooting lane through the building, only a series of short ones.
 *
 * Night and fog on top of an indoor map is the point at which `flashlight` and `nvg` (data/equipment.ts) stop
 * being flavour - between them they halve both penalties.
 */
function compose(): string[] {
  const W = 46, H = 22;
  const g = field(W, H);
  hRun(g, 0, 0, W, '#');
  hRun(g, 0, H - 1, W, '#');
  vRun(g, 0, 0, H, '#');
  vRun(g, W - 1, 0, H, '#');

  // Four halls, three dividing walls, two doors each.
  const divider = (x: number, doors: number[]) => {
    vRun(g, x, 1, H - 2, '#');
    for (const y of doors) put(g, x, y, '.');
  };
  divider(11, [5, 16]);
  divider(23, [3, 14]);
  divider(34, [8, 18]);

  // Hall 1 (the yard-side receiving bay): loose pallets, a foreman's office.
  building(g, 2, 1, 6, 5, [[5, 5]]);
  pts(g, [[3, 9], [4, 9], [8, 11], [3, 15], [4, 15], [8, 18]], 'l');
  pts(g, [[6, 13], [6, 14]], 'h');

  // Halls 2 and 3: freezer racks, north-south so no lane runs the length of the plant.
  const rack = (x: number, y: number, h: number) => rect(g, x, y, 2, h, 'h');
  rack(14, 1, 6); rack(18, 1, 6);
  rack(14, 9, 5); rack(18, 9, 5);
  rack(14, 16, 5); rack(18, 16, 5);
  rack(26, 2, 7); rack(30, 2, 7);
  rack(26, 13, 7); rack(30, 13, 7);
  pts(g, [[27, 10], [28, 10], [31, 11], [32, 11]], 'l'); // stacked crates in the cross-aisle

  // Hall 4: the loading dock, and the extraction zone in the corner.
  building(g, 36, 1, 6, 5, [[38, 5]]);                 // dispatch office
  pts(g, [[37, 9], [38, 9], [42, 12], [43, 12]], 'l');
  pts(g, [[40, 7], [41, 7], [36, 15], [36, 16]], 'h');
  stamp(g, 41, 17, [
    'OOO',
    'OOO',
    'OOO',
  ]);
  return toRows(g);
}

export const COLD_STORAGE: MapDef = {
  name: 'Bellweather Cold Storage',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 10], ['assault', 3, 11], ['medic', 2, 12], ['tank', 2, 17], ['sniper', 3, 17]],
    enemy: [['assault', 16, 7], ['soldier', 20, 19], ['sniper', 28, 1], ['assault', 39, 13]],
  },
  searchPoints: {
    player: [[16, 7], [28, 11], [39, 12], [40, 18]],
    enemy: [[16, 18], [28, 11], [6, 11], [39, 17]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'fog',
  enemyProfile: 'standard',
  objective: { type: 'reach', unitsRequired: 3 },
  interactables: [
    { id: 1, type: 'door', x: 11, y: 5, active: true },
    { id: 2, type: 'door', x: 11, y: 16 },
    { id: 3, type: 'door', x: 23, y: 3, active: true },
    { id: 4, type: 'door', x: 23, y: 14 },
    { id: 5, type: 'door', x: 34, y: 8, active: true },
    { id: 6, type: 'door', x: 34, y: 18 },
    { id: 7, type: 'door', x: 5, y: 5, active: true },
    { id: 8, type: 'door', x: 38, y: 5 },
    { id: 20, type: 'chest', x: 4, y: 2 },
    { id: 21, type: 'chest', x: 39, y: 2 },
    { id: 22, type: 'chest', x: 24, y: 20 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 7, y: 7 },
    { id: 2, type: 'medkit', x: 16, y: 13 },
    { id: 3, type: 'ammo', x: 21, y: 19 },
    { id: 4, type: 'gadget', x: 28, y: 11 },
    { id: 5, type: 'ammo', x: 32, y: 19 },
    { id: 6, type: 'medkit', x: 40, y: 15 },
  ],
};
