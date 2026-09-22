import { building, coverPairs, field, hRun, pts, put, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 4 of 5 - "The Pumphouse". Objective: `sabotage`, three valves.
 *
 * The mission that uses the interactable system for something other than a wall with a hole in it. Three
 * valves have to be turned. One is out in the open in the pipe gallery; the other two are inside settling
 * tanks whose hatches (doors 2, 3 and 4) start closed.
 *
 * There are two ways to get those hatches open, and the whole map is built to make it a real choice:
 *   - walk to each one and lever it, which costs an action each and means three separate approaches; or
 *   - reach the sluice board in the control room at (44,22) and throw the master switch, which is linked to
 *     all three hatches and opens them together - but the control room is at the far south-east corner, past
 *     everything.
 * The master switch is *not* one of the objective's three valves. It is a shortcut, not a step, and because a
 * switch toggles, throwing it after you have already levered a hatch by hand shuts that one again.
 *
 * The pipe gallery in the middle is staggered walls with offset gaps: no shot crosses it in a straight line,
 * and neither does anybody walking.
 */
function compose(): string[] {
  const g = field();
  hRun(g, 0, 0, 48, '#');
  hRun(g, 0, 31, 48, '#');
  vRun(g, 0, 0, 32, '#');
  vRun(g, 47, 0, 32, '#');

  // --- west: the approach yard ---
  building(g, 1, 2, 7, 7, [[4, 8]]);            // gatehouse
  pts(g, [[2, 13], [3, 13], [6, 17], [7, 17], [2, 22], [3, 22], [6, 26], [7, 26]], 'h');
  pts(g, [[4, 11], [5, 11], [4, 28], [5, 28]], 'b');

  // --- middle: the pipe gallery. Staggered runs, offset gaps, nothing lines up. ---
  const run = (y: number, gaps: number[]) => {
    hRun(g, 11, y, 18, '#');
    for (const x of gaps) put(g, x, y, '.');
  };
  run(5, [15, 24]);
  run(11, [13, 22, 27]);
  run(17, [18, 26]);
  run(23, [14, 20, 28]);
  coverPairs(g, 8, [12, 20, 26]);
  coverPairs(g, 14, [16, 24]);
  coverPairs(g, 20, [12, 22]);
  pts(g, [[17, 27], [18, 27], [25, 27], [26, 27], [13, 2], [14, 2], [24, 2], [25, 2]], 'h');

  // --- east: the tank farm and the plant rooms ---
  building(g, 31, 2, 9, 8, [[34, 9]]);          // settling tank 1  (hatch = door 2)
  building(g, 31, 13, 9, 7, [[34, 13]]);        // settling tank 2  (hatch = door 3)
  building(g, 31, 23, 9, 7, [[34, 23]]);        // settling tank 3  (hatch = door 4)
  building(g, 41, 3, 6, 9, [[41, 7]]);          // pump hall
  building(g, 41, 18, 6, 9, [[41, 22]]);        // control room - the sluice board is in here
  pts(g, [[33, 5], [34, 5], [37, 16], [33, 26], [34, 26]], 'l'); // plant inside the tanks
  pts(g, [[43, 5], [44, 5], [43, 24], [44, 24]], 'l');
  coverPairs(g, 11, [30, 36]); // not x=43: that row is the pump hall's south wall
  coverPairs(g, 21, [30, 43]);
  pts(g, [[36, 29], [37, 29], [30, 1], [31, 1]], 'b');
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map pumphouse --objective player`):
// player 80% / enemy 17% / draw 3%, ~14 turns.
export const PUMPHOUSE: MapDef = {
  name: 'Dawes Street Pumphouse',
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 16], ['assault', 3, 16], ['medic', 2, 18], ['tank', 2, 20], ['sniper', 3, 20]],
    enemy: [
      ['assault', 16, 8], ['soldier', 23, 14], ['assault', 18, 21],
      ['soldier', 30, 6], ['sniper', 44, 9], ['assault', 29, 16],
    ],
  },
  searchPoints: {
    player: [[20, 14], [34, 11], [45, 21], [34, 21]],
    enemy: [[20, 14], [6, 16], [34, 11], [24, 27]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'rain',
  enemyProfile: 'standard',
  objective: { type: 'sabotage', interactableIds: [10, 11, 12] },
  interactables: [
    { id: 1, type: 'door', x: 4, y: 8, active: true },
    { id: 2, type: 'door', x: 34, y: 9 },   // tank 1 hatch
    { id: 3, type: 'door', x: 34, y: 13 },  // tank 2 hatch
    { id: 4, type: 'door', x: 34, y: 23 },  // tank 3 hatch
    { id: 5, type: 'door', x: 41, y: 7, active: true },
    { id: 6, type: 'door', x: 41, y: 22, active: true },
    { id: 10, type: 'switch', x: 22, y: 8 },   // valve A - out in the gallery
    { id: 11, type: 'switch', x: 36, y: 4 },   // valve B - tank 1
    { id: 12, type: 'switch', x: 36, y: 26 },  // valve C - tank 3
    { id: 13, type: 'switch', x: 44, y: 22, links: [2, 3, 4] }, // the sluice board
    { id: 20, type: 'chest', x: 3, y: 4 },
    { id: 21, type: 'chest', x: 44, y: 6 },
    { id: 22, type: 'chest', x: 36, y: 16 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 9, y: 14 },
    { id: 2, type: 'medkit', x: 15, y: 18 },
    { id: 3, type: 'ammo', x: 25, y: 20 },
    { id: 4, type: 'gadget', x: 20, y: 25 },
    { id: 5, type: 'ammo', x: 30, y: 16 },
    { id: 6, type: 'medkit', x: 38, y: 21 },
  ],
};
