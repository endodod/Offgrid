import { building, coverPairs, field, hRun, pts, stamp, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 1 of 5 - "Supply Run: Market Row". Objective: `reach`, 3 units to the loading bay.
 *
 * A west-to-east run down a covered market street. Shopfronts line the top and bottom, each with one doorway
 * onto the street; stall islands make the cover in the middle; the loading bay is the east corner.
 *
 * `unitsRequired: 3`, not 5, is the point of the mission: it is "get the crates out", not "get everybody
 * out". Losing somebody on the way is a setback, not an automatic restart. It is also the first mission low
 * enough stakes to be worth handing to auto-run (`P`), which is by design.
 *
 * The crates are ordinary pickups and nothing forces you to take them - but both chests are inside shopfronts
 * and three of the eight Jackals are sitting in shopfronts too, so stepping off the straight line between the
 * spawn and the exit is a decision rather than free money.
 */
function compose(): string[] {
  const g = field();
  hRun(g, 0, 0, 48, '#');
  hRun(g, 0, 31, 48, '#');
  vRun(g, 0, 0, 32, '#');
  vRun(g, 47, 0, 32, '#');

  // Shopfronts, north and south. Each is one room with one doorway onto the street.
  const shopsN: [number, number, number][] = [[1, 8, 4], [10, 7, 13], [18, 9, 22], [28, 8, 32], [37, 8, 41]];
  for (const [x, w, door] of shopsN) building(g, x, 1, w, 7, [[door, 7]]);
  const shopsS: [number, number, number][] = [[1, 9, 4], [11, 8, 15], [20, 7, 23], [28, 9, 32], [38, 8, 42]];
  for (const [x, w, door] of shopsS) building(g, x, 24, w, 7, [[door, 24]]);

  // The street: stall islands, collapsed awnings, and a long clear lane nobody should want to use.
  coverPairs(g, 10, [4, 13, 22, 31]);
  coverPairs(g, 13, [8, 17, 26, 35]);
  coverPairs(g, 20, [4, 13, 22, 31]);
  coverPairs(g, 17, [11, 20, 29]);
  pts(g, [[6, 16], [7, 16], [15, 22], [16, 22], [24, 12], [25, 12], [33, 18], [34, 18]], 'h');
  pts(g, [[9, 19], [10, 19], [9, 20], [18, 15], [19, 15], [27, 21], [28, 21], [36, 14], [37, 14]], 'b');

  // The loading bay.
  building(g, 41, 11, 6, 10, [[41, 15]]);
  stamp(g, 42, 12, [
    'OOOO',
    'OOOO',
    'OOOO',
    'OOOO',
    'OOOO',
  ]);
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map market-row --objective player`):
// player 97% / enemy 2%, ~10 turns - deliberately the softest mission in the district.
export const MARKET_ROW: MapDef = {
  name: 'Market Row',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 14], ['assault', 3, 14], ['medic', 2, 16], ['tank', 2, 18], ['sniper', 3, 18]],
    enemy: [
      ['assault', 14, 16], ['soldier', 24, 17], ['sniper', 33, 12], ['assault', 21, 21], ['soldier', 13, 4],
    ],
  },
  searchPoints: {
    player: [[16, 16], [26, 16], [36, 16], [44, 18]],
    enemy: [[16, 16], [26, 16], [6, 15], [36, 16]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'rain',
  enemyProfile: 'easy',
  objective: { type: 'reach', unitsRequired: 3 },
  interactables: [
    { id: 1, type: 'door', x: 41, y: 15, active: true },
    { id: 20, type: 'chest', x: 4, y: 4 },
    { id: 21, type: 'chest', x: 31, y: 27 },
    { id: 22, type: 'chest', x: 40, y: 4 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 16 },
    { id: 2, type: 'medkit', x: 15, y: 12 },
    { id: 3, type: 'ammo', x: 23, y: 16 },
    { id: 4, type: 'gadget', x: 30, y: 16 },
    { id: 5, type: 'ammo', x: 37, y: 11 },
    { id: 6, type: 'medkit', x: 38, y: 22 },
  ],
};
