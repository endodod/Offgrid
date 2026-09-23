import { building, coverPairs, field, hRun, pts, put, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 4 of 5 - "The Pumphouse". Objective: `sabotage`, three valves. 30x40 (19: the first tall
 * map - the squad pushes north, up from the river road to the tank farm).
 *
 * The mission that uses the interactable system for something other than a wall with a hole in it. Three
 * valves have to be turned. One is out in the open in the pipe gallery; the other two are inside settling
 * tanks whose hatches (doors 2, 3 and 4) start closed.
 *
 * There are two ways to get those hatches open, and the whole map is built to make it a real choice:
 *   - walk to each one and lever it, which costs an action each and means separate approaches; or
 *   - reach the sluice board in the control room at (26,12) and throw the master switch, which is linked to
 *     all three hatches and opens them together - but the control room is at the far east of the tank farm.
 * The master switch is *not* one of the objective's three valves. It is a shortcut, not a step, and because a
 * switch toggles, throwing it after you have already levered a hatch by hand shuts that one again.
 *
 * The pipe gallery in the middle is staggered walls with offset gaps: no shot crosses it in a straight line,
 * and neither does anybody walking.
 */
function compose(): string[] {
  const W = 30, H = 40;
  const g = field(W, H);
  hRun(g, 0, 0, W, '#');
  hRun(g, 0, H - 1, W, '#');
  vRun(g, 0, 0, H, '#');
  vRun(g, W - 1, 0, H, '#');

  // --- south: the approach yard off the river road ---
  building(g, 2, 32, 7, 6, [[5, 32]]);          // gatehouse
  pts(g, [[13, 34], [14, 34], [20, 35], [21, 35]], 'h');
  pts(g, [[10, 31], [24, 33], [25, 33]], 'b');

  // --- middle: the pipe gallery. Staggered runs, offset gaps, nothing lines up. ---
  const run = (y: number, gaps: number[]) => {
    hRun(g, 3, y, 24, '#');
    for (const x of gaps) { put(g, x, y, '.'); put(g, x + 1, y, '.'); } // two-wide: one-tile gaps were kill zones
  };
  run(28, [7, 16, 23]);
  run(23, [4, 12, 20]);
  run(18, [9, 17, 25]);
  coverPairs(g, 26, [4, 18]);
  coverPairs(g, 20, [5, 21]);
  pts(g, [[13, 25], [14, 25], [3, 16], [4, 16], [24, 15], [25, 15]], 'h');

  // --- north: the tank farm and the control room ---
  building(g, 2, 2, 8, 7, [[5, 8]]);            // settling tank 1  (hatch = door 2)
  building(g, 11, 2, 8, 7, [[14, 8]]);          // settling tank 2  (hatch = door 3)
  building(g, 20, 2, 8, 7, [[23, 8]]);          // settling tank 3  (hatch = door 4)
  building(g, 21, 10, 8, 5, [[21, 12]]);        // control room - the sluice board is in here
  pts(g, [[7, 5], [16, 5], [17, 5]], 'l');      // plant inside the tanks
  coverPairs(g, 11, [3, 12]);
  pts(g, [[17, 12], [18, 12]], 'h');
  pts(g, [[8, 14], [9, 14], [1, 12]], 'b');
  return toRows(g);
}

export const PUMPHOUSE: MapDef = {
  name: 'Dawes Street Pumphouse',
  rows: compose(),
  spawns: {
    player: [['soldier', 12, 37], ['assault', 14, 37], ['medic', 16, 37], ['tank', 13, 38], ['sniper', 15, 38]],
    enemy: [['assault', 8, 25], ['soldier', 19, 20], ['sniper', 6, 11], ['soldier', 24, 16]],
  },
  searchPoints: {
    player: [[14, 20], [5, 10], [14, 10], [20, 12]],
    enemy: [[14, 20], [14, 33], [5, 10], [20, 26]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'rain',
  enemyProfile: 'standard',
  objective: { type: 'sabotage', interactableIds: [10, 11, 12] },
  interactables: [
    { id: 1, type: 'door', x: 5, y: 32, active: true },
    { id: 2, type: 'door', x: 5, y: 8 },    // tank 1 hatch
    { id: 3, type: 'door', x: 14, y: 8 },   // tank 2 hatch
    { id: 4, type: 'door', x: 23, y: 8 },   // tank 3 hatch
    { id: 6, type: 'door', x: 21, y: 12, active: true },
    { id: 10, type: 'switch', x: 15, y: 21 },  // valve A - out in the gallery
    { id: 11, type: 'switch', x: 4, y: 4 },    // valve B - tank 1
    { id: 12, type: 'switch', x: 25, y: 4 },   // valve C - tank 3
    { id: 13, type: 'switch', x: 26, y: 12, links: [2, 3, 4] }, // the sluice board
    { id: 20, type: 'chest', x: 4, y: 35 },
    { id: 21, type: 'chest', x: 16, y: 4 },
    { id: 22, type: 'chest', x: 27, y: 13 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 24, y: 34 },
    { id: 2, type: 'medkit', x: 4, y: 21 },
    { id: 3, type: 'ammo', x: 20, y: 26 },
    { id: 4, type: 'gadget', x: 10, y: 20 },
    { id: 5, type: 'ammo', x: 19, y: 11 },
    { id: 6, type: 'medkit', x: 26, y: 17 },
  ],
};
