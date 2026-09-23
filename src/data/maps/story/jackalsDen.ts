import { building, coverPairs, field, hRun, pts, put, rect, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 5 of 5 - "The Jackals' Den". Objective: `eliminateTarget`, Vex (enemy spawn index 0).
 *
 * The act finale, and the biggest fight in the game: an approach yard, a freight warehouse, and Vex's office
 * behind it. Ten Jackals.
 *
 * Every idea the act has taught gets asked for once more. The dock wall has three doors, one already up and
 * two shut, so the squad picks its breach (Lights Out). The shelving is single rows with a clear aisle behind
 * each, so nothing is a stalemate (this map's own balance history, below). The office is a walled box with
 * one closed door at the far end, so the last thing the mission asks is the same thing the first one did:
 * open something and go in.
 *
 * Vex is a `tank` on the `camper` profile rather than a bespoke stat block. A class with 24 HP and 3 armor
 * behind a door already reads as "the one you have to dig out", and `data/units.ts` has no per-instance stats
 * to hang a boss on. The roadmap's suggested "boss affix" turned out not to be needed.
 *
 * Balance note worth keeping: at 24x16 an earlier version of this map used *double* rows of shelving, and
 * ~60% of AI-vs-AI runs timed out because nothing could be flanked. Single rows with an aisle behind each
 * fixed it. The rule generalised to every map here: high cover in lines, never in slabs.
 */
function compose(): string[] {
  const g = field();
  hRun(g, 0, 0, 48, '#');
  hRun(g, 0, 31, 48, '#');
  vRun(g, 0, 0, 32, '#');
  vRun(g, 47, 0, 32, '#');

  // --- west: the yard ---
  building(g, 1, 2, 7, 6, [[4, 7]]);           // gatehouse
  building(g, 1, 24, 7, 6, [[4, 24]]);         // fuel store
  coverPairs(g, 11, [2, 7]);
  coverPairs(g, 19, [2, 7]);
  pts(g, [[5, 14], [6, 14], [5, 16], [6, 16], [10, 9], [10, 10], [10, 22], [10, 23]], 'h');
  pts(g, [[9, 4], [10, 4], [9, 27], [10, 27], [3, 20], [12, 15]], 'b');

  // --- the dock wall: three doors, one up and two down ---
  vRun(g, 13, 1, 30, '#');
  for (const y of [6, 16, 26]) put(g, 13, y, '.');

  // --- the warehouse: four single shelving rows, each with a clear aisle behind it ---
  for (const y of [4, 9, 14, 19, 24]) {
    rect(g, 16, y, 9, 1, 'h');
    rect(g, 28, y, 9, 1, 'h');
  }
  pts(g, [[26, 7], [26, 8], [26, 21], [26, 22], [38, 11], [38, 12]], 'l'); // pallet stacks in the cross-aisle
  pts(g, [[20, 28], [21, 28], [32, 28], [33, 28], [20, 1], [33, 1]], 'b');

  // --- the office: one door, at the far end of the building ---
  building(g, 38, 17, 9, 12, [[38, 22]]);
  pts(g, [[41, 19], [42, 19], [41, 26], [42, 26]], 'l');
  building(g, 38, 2, 9, 8, [[42, 9]]);          // dispatch, a second room worth clearing
  pts(g, [[40, 4], [41, 4], [44, 6], [45, 6]], 'l');
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map jackals-den --objective player`):
// with the office door opened so the fight is measurable, a fresh squad wins 22%, a level-3 squad 38%, a level-5 squad 67%.
export const JACKALS_DEN: MapDef = {
  name: "The Jackals' Den",
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 15], ['assault', 3, 15], ['medic', 2, 17], ['tank', 2, 12], ['sniper', 3, 12]],
    enemy: [
      ['tank', 44, 22, 'camper'],
      ['assault', 17, 12], ['soldier', 22, 17], ['sniper', 20, 6], ['assault', 31, 12],
      ['sniper', 42, 5],
    ],
  },
  searchPoints: {
    player: [[20, 16], [31, 16], [40, 15], [42, 25]],
    enemy: [[20, 16], [31, 16], [8, 16], [40, 15]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'cloudy',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Vex, the Jackal leader' },
  // 10j: the boss room is sealed on purpose - the squad breaches it, the boss never walks out.
  aiOpensDoors: false,
  interactables: [
    { id: 1, type: 'door', x: 13, y: 16, active: true },  // the dock door already up
    { id: 2, type: 'door', x: 13, y: 6 },
    { id: 3, type: 'door', x: 13, y: 26 },
    { id: 4, type: 'door', x: 38, y: 22 },                // the office, shut
    { id: 5, type: 'door', x: 42, y: 9, active: true },   // dispatch
    { id: 6, type: 'door', x: 4, y: 7, active: true },
    { id: 7, type: 'door', x: 4, y: 24 },
    { id: 20, type: 'chest', x: 4, y: 4 },
    { id: 21, type: 'chest', x: 4, y: 27 },
    { id: 22, type: 'chest', x: 40, y: 6 },
    { id: 23, type: 'chest', x: 45, y: 19 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 9, y: 16 },
    { id: 2, type: 'medkit', x: 18, y: 16 },
    { id: 3, type: 'ammo', x: 26, y: 12 },
    { id: 4, type: 'gadget', x: 26, y: 16 },
    { id: 5, type: 'ammo', x: 34, y: 16 },
    { id: 6, type: 'medkit', x: 38, y: 16 },
    { id: 7, type: 'ammo', x: 20, y: 21 },
  ],
};
