import { building, coverPairs, field, hRun, pts, stamp, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 1 of 5 - "Supply Run: Market Row". Objective: `reach`, 3 units to the loading bay.
 *
 * 56x24 (19: a long street, the longest walk to an exit in the act). A west-to-east run down a covered market street. Shopfronts line the top and bottom, each with one doorway
 * onto the street; stall islands make the cover in the middle; the loading bay is the east corner.
 *
 * `unitsRequired: 3`, not 5, is the point of the mission: it is "get the crates out", not "get everybody
 * out". Losing somebody on the way is a setback, not an automatic restart. It is also the first mission low
 * enough stakes to be worth handing to auto-run (`P`), which is by design.
 *
 * The crates are ordinary pickups and nothing forces you to take them - but both chests are inside shopfronts
 * and one of the five Jackals is sitting in a shopfront too, so stepping off the straight line between the
 * spawn and the exit is a decision rather than free money.
 */
function compose(): string[] {
  const W = 56, H = 24;
  const g = field(W, H);
  hRun(g, 0, 0, W, '#');
  hRun(g, 0, H - 1, W, '#');
  vRun(g, 0, 0, H, '#');
  vRun(g, W - 1, 0, H, '#');

  // Shopfronts, north and south. Each is one room with one doorway onto the street.
  const shopsN: [number, number, number][] = [[1, 8, 4], [10, 7, 13], [18, 9, 22], [28, 8, 32], [37, 8, 41], [46, 9, 50]];
  for (const [x, w, door] of shopsN) building(g, x, 1, w, 6, [[door, 6]]);
  const shopsS: [number, number, number][] = [[1, 9, 4], [11, 8, 15], [20, 7, 23], [28, 9, 32], [38, 8, 42]];
  for (const [x, w, door] of shopsS) building(g, x, 17, w, 6, [[door, 17]]);

  // The street: stall islands, collapsed awnings, and a long clear lane nobody should want to use.
  coverPairs(g, 9, [5, 14, 23, 32, 41]);
  coverPairs(g, 12, [9, 18, 27, 36]);
  coverPairs(g, 14, [4, 13, 22, 31, 40]);
  pts(g, [[7, 11], [8, 11], [16, 15], [17, 15], [25, 10], [26, 10], [34, 13], [35, 13]], 'h');
  pts(g, [[10, 15], [11, 15], [19, 8], [20, 8], [28, 15], [29, 15], [38, 10], [39, 10]], 'b');

  // The loading bay, at the east end of the street.
  building(g, 48, 8, 7, 9, [[48, 12]]);
  stamp(g, 50, 9, [
    'OOOO',
    'OOOO',
    'OOOO',
    'OOOO',
    'OOOO',
  ]);
  return toRows(g);
}

export const MARKET_ROW: MapDef = {
  name: 'Market Row',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 9], ['assault', 3, 10], ['medic', 2, 11], ['tank', 2, 13], ['sniper', 3, 13]],
    enemy: [
      ['assault', 14, 11], ['soldier', 24, 13], ['sniper', 34, 9], ['assault', 21, 15], ['soldier', 13, 4],
    ],
  },
  searchPoints: {
    player: [[16, 11], [27, 11], [40, 11], [46, 12]],
    enemy: [[16, 11], [27, 11], [6, 10], [40, 11]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'rain',
  enemyProfile: 'easy',
  objective: { type: 'reach', unitsRequired: 3 },
  interactables: [
    { id: 1, type: 'door', x: 48, y: 12, active: true },
    { id: 20, type: 'chest', x: 4, y: 3 },
    { id: 21, type: 'chest', x: 31, y: 20 },
    { id: 22, type: 'chest', x: 40, y: 3 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 10 },
    { id: 2, type: 'medkit', x: 15, y: 13 },
    { id: 3, type: 'ammo', x: 23, y: 11 },
    { id: 4, type: 'gadget', x: 30, y: 11 },
    { id: 5, type: 'ammo', x: 38, y: 15 },
    { id: 6, type: 'medkit', x: 45, y: 13 },
  ],
};
