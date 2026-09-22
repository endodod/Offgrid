import { building, field, hRun, pts, put, rect, stamp, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 3 of 5 - "Cold Storage". Objective: `reach`, 3 units to the dock.
 *
 * The first properly indoor map: a meat-packing plant, west to east, four halls deep. Every hall is divided
 * from the next by a solid wall with exactly two roller doors in it. One of each pair is already up and one is
 * down, so every hall has a route the Jackals will use and a second route only the squad can open. The AI does
 * not open doors (see ROADMAP #0c), and that asymmetry is the mission's whole idea: a door you open is a flank
 * you then have to watch, and a door you leave shut is one that stays shut.
 *
 * Freezer racks run north-south, not east-west, so the aisles point across the line of advance instead of
 * along it: there is no long shooting lane through the building, only a series of short ones.
 *
 * Night and fog on top of an indoor map is the point at which `flashlight` and `nvg` (data/equipment.ts) stop
 * being flavour - between them they halve both penalties, and this is the first mission that punishes not
 * having brought either.
 */
function compose(): string[] {
  const g = field();
  hRun(g, 0, 0, 48, '#');
  hRun(g, 0, 31, 48, '#');
  vRun(g, 0, 0, 32, '#');
  vRun(g, 47, 0, 32, '#');

  // Four halls, three dividing walls, two doors each.
  const divider = (x: number, doors: number[]) => {
    vRun(g, x, 1, 30, '#');
    for (const y of doors) put(g, x, y, '.');
  };
  divider(11, [7, 23]);
  divider(23, [4, 17]);
  divider(35, [11, 26]);

  // Hall 1 (the yard-side receiving bay): loose pallets, a foreman's office.
  building(g, 2, 2, 7, 6, [[5, 7]]);
  pts(g, [[3, 13], [4, 13], [8, 15], [9, 15], [3, 20], [4, 20], [8, 25], [9, 25]], 'l');
  pts(g, [[6, 17], [6, 18], [7, 28], [8, 28]], 'h');

  // Halls 2 and 3: freezer racks, north-south so no lane runs the length of the plant.
  const rack = (x: number, y: number, h: number) => rect(g, x, y, 2, h, 'h');
  rack(14, 2, 7); rack(18, 2, 7);
  rack(14, 12, 7); rack(18, 12, 7);
  rack(14, 22, 7); rack(18, 22, 7);
  rack(26, 3, 9); rack(30, 3, 9);
  rack(26, 19, 9); rack(30, 19, 9);
  pts(g, [[27, 15], [28, 15], [31, 15], [32, 15]], 'l'); // stacked crates in the cross-aisle

  // Hall 4: the loading dock. Three bays of open floor, and the extraction zone in the corner.
  building(g, 37, 2, 6, 6, [[39, 7]]);                 // dispatch office
  pts(g, [[38, 12], [39, 12], [43, 14], [44, 14], [38, 21], [39, 21]], 'l');
  pts(g, [[42, 10], [43, 10], [37, 17], [37, 18]], 'h');
  stamp(g, 42, 25, [
    'OOOO',
    'OOOO',
    'OOOO',
  ]);
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map cold-storage --objective player`):
// player 63% / enemy 10% / draw 27%, ~20 turns.
export const COLD_STORAGE: MapDef = {
  name: 'Bellweather Cold Storage',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 16], ['assault', 3, 16], ['medic', 2, 18], ['tank', 2, 22], ['sniper', 3, 22]],
    enemy: [
      ['assault', 16, 10], ['soldier', 20, 20], ['sniper', 28, 2], ['assault', 28, 14],
      ['assault', 40, 16],
    ],
  },
  searchPoints: {
    player: [[16, 10], [28, 16], [40, 16], [44, 22]],
    enemy: [[16, 20], [28, 16], [6, 16], [40, 22]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'fog',
  enemyProfile: 'standard',
  objective: { type: 'reach', unitsRequired: 3 },
  interactables: [
    { id: 1, type: 'door', x: 11, y: 7, active: true },
    { id: 2, type: 'door', x: 11, y: 23 },
    { id: 3, type: 'door', x: 23, y: 4, active: true },
    { id: 4, type: 'door', x: 23, y: 17 },
    { id: 5, type: 'door', x: 35, y: 11, active: true },
    { id: 6, type: 'door', x: 35, y: 26 },
    { id: 7, type: 'door', x: 5, y: 7, active: true },
    { id: 8, type: 'door', x: 39, y: 7 },
    { id: 20, type: 'chest', x: 5, y: 4 },
    { id: 21, type: 'chest', x: 40, y: 4 },
    { id: 22, type: 'chest', x: 24, y: 29 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 7, y: 9 },
    { id: 2, type: 'medkit', x: 16, y: 16 },
    { id: 3, type: 'ammo', x: 21, y: 26 },
    { id: 4, type: 'gadget', x: 28, y: 16 },
    { id: 5, type: 'ammo', x: 33, y: 24 },
    { id: 6, type: 'medkit', x: 41, y: 20 },
  ],
};
