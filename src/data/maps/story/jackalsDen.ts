import { building, coverPairs, field, hRun, pts, put, rect, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Market Row, mission 5 of 5 - "The Jackals' Den". Objective: `eliminateTarget`, Vex (enemy spawn index 0).
 * 56x36 (19: the biggest map in the act, for its finale).
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
  const W = 56, H = 36;
  const g = field(W, H);
  hRun(g, 0, 0, W, '#');
  hRun(g, 0, H - 1, W, '#');
  vRun(g, 0, 0, H, '#');
  vRun(g, W - 1, 0, H, '#');

  // --- west: the yard ---
  building(g, 1, 2, 7, 6, [[4, 7]]);           // gatehouse
  building(g, 1, 28, 7, 6, [[4, 28]]);         // fuel store
  coverPairs(g, 12, [2, 7]);
  coverPairs(g, 23, [2, 7]);
  pts(g, [[5, 17], [6, 17], [5, 19], [6, 19], [11, 10], [11, 11], [11, 25], [11, 26]], 'h');
  pts(g, [[9, 4], [10, 4], [9, 31], [10, 31], [3, 21], [13, 18]], 'b');

  // --- the dock wall: three doors, one up and two down ---
  vRun(g, 15, 1, H - 2, '#');
  for (const y of [7, 18, 28]) put(g, 15, y, '.');

  // --- the warehouse: single shelving rows, each with a clear aisle behind it ---
  for (const y of [4, 9, 14, 19, 24, 29]) {
    rect(g, 18, y, 10, 1, 'h');
    rect(g, 31, y, 10, 1, 'h');
  }
  pts(g, [[29, 7], [29, 8], [29, 21], [29, 22], [42, 12], [42, 13]], 'l'); // pallet stacks in the cross-aisle
  pts(g, [[22, 33], [23, 33], [35, 33], [36, 33], [22, 1], [36, 1]], 'b');

  // --- the office: one door, at the far end of the building ---
  building(g, 44, 20, 11, 13, [[44, 26]]);
  pts(g, [[47, 22], [48, 22], [47, 30], [48, 30]], 'l');
  building(g, 44, 2, 11, 9, [[49, 10]]);         // dispatch, a second room worth clearing
  pts(g, [[46, 4], [47, 4], [51, 7], [52, 7]], 'l');
  return toRows(g);
}

export const JACKALS_DEN: MapDef = {
  name: "The Jackals' Den",
  rows: compose(),
  spawns: {
    player: [['soldier', 2, 17], ['assault', 3, 17], ['medic', 2, 19], ['tank', 2, 14], ['sniper', 3, 14]],
    enemy: [
      ['tank', 50, 26, 'camper'],
      ['assault', 20, 12], ['soldier', 25, 17], ['soldier', 22, 6], ['assault', 34, 12],
      ['sniper', 50, 5],
    ],
  },
  searchPoints: {
    player: [[22, 17], [35, 17], [44, 17], [48, 27]],
    enemy: [[22, 17], [35, 17], [8, 17], [44, 17]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'cloudy',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Vex, the Jackal leader' },
  // 10j: the boss room is sealed on purpose - the squad breaches it, the boss never walks out.
  aiOpensDoors: false,
  interactables: [
    { id: 1, type: 'door', x: 15, y: 18, active: true },  // the dock door already up
    { id: 2, type: 'door', x: 15, y: 7 },
    { id: 3, type: 'door', x: 15, y: 28 },
    { id: 4, type: 'door', x: 44, y: 26 },                // the office, shut
    { id: 5, type: 'door', x: 49, y: 10, active: true },  // dispatch
    { id: 6, type: 'door', x: 4, y: 7, active: true },
    { id: 7, type: 'door', x: 4, y: 28 },
    { id: 20, type: 'chest', x: 4, y: 4 },
    { id: 21, type: 'chest', x: 4, y: 31 },
    { id: 22, type: 'chest', x: 46, y: 6 },
    { id: 23, type: 'chest', x: 52, y: 22 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 10, y: 18 },
    { id: 2, type: 'medkit', x: 20, y: 17 },
    { id: 3, type: 'ammo', x: 29, y: 12 },
    { id: 4, type: 'gadget', x: 29, y: 17 },
    { id: 5, type: 'ammo', x: 38, y: 17 },
    { id: 6, type: 'medkit', x: 42, y: 17 },
    { id: 7, type: 'ammo', x: 22, y: 26 },
  ],
};
