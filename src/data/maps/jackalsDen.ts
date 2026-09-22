import type { MapDef } from '../trainingGrounds';

/**
 * Act 1, mission 4 - "The Jackals' Den" (Market Row). The act finale.
 *
 * An approach yard on the west and a warehouse filling the east, separated by a solid wall at x=8 with two
 * loading-dock doors: (8,11) is rolled up already (so the Jackals inside can and do come out to meet the
 * squad) and (8,7) is shut (so the player has a second breach point to open on their own terms).
 *
 * Inside, the shelving is four single rows of high cover with a clear aisle behind each. That thinning was a
 * balance fix, not a style choice: with double rows nothing could be flanked and AI-vs-AI runs timed out ~60%
 * of the time (`npm run sim -- --map jackals-den`). Vex's office is the walled box in the north-east corner
 * behind one door at (21,5) - closed, because digging him out is the finale. He is spawn index 0, which is
 * what `eliminateTarget` names.
 *
 * Sim, with that office door opened so the fight itself is measurable: a fresh squad wins ~47%, a level-3
 * squad ~78%, a level-5 squad ~94%. An act finale that a starting squad can lose and a developed one beats is
 * the intended shape.
 *
 * Vex is a `tank` on the `camper` profile rather than a new stat block: a class with 24 HP and 3 armor behind
 * a door already reads as "the one you have to dig out", and `data/units.ts` has no per-instance stats to hang
 * a bespoke boss on (see ROADMAP's Act 1 open questions).
 */
export const JACKALS_DEN: MapDef = {
  name: "The Jackals' Den",
  rows: [
    '........################',
    '..ll....#..........#####',
    '........#..hhhh....#...#',
    '....bb..#..........#...#',
    '....bb..#..........#...#',
    '........#..hhhh....##.##',
    '..h.....#..............#',
    '.......................#',
    '........#..hhhh...hhhh.#',
    '..h...h.#..............#',
    '........#..............#',
    '.......................#',
    '.ll.....#..hhhh...hhhh.#',
    '........#..............#',
    '....hh..#..............#',
    '........################',
  ],
  spawns: {
    player: [['soldier', 2, 7], ['assault', 3, 7], ['medic', 2, 8], ['tank', 1, 9], ['sniper', 3, 9]],
    enemy: [
      ['tank', 21, 3, 'camper'],
      ['assault', 12, 7], ['soldier', 16, 10], ['sniper', 22, 13], ['assault', 11, 11],
    ],
  },
  searchPoints: {
    player: [[12, 7], [20, 10], [18, 11]],
    enemy: [[12, 10], [20, 10], [10, 4]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'cloudy',
  enemyProfile: 'standard',
  objective: { type: 'eliminateTarget', enemySpawnIndex: 0, label: 'Vex, the Jackal leader' },
  interactables: [
    { id: 1, type: 'door', x: 8, y: 11, active: true },
    { id: 2, type: 'door', x: 8, y: 7 },
    { id: 3, type: 'door', x: 21, y: 5 },
    { id: 20, type: 'chest', x: 20, y: 2 },
    { id: 21, type: 'chest', x: 3, y: 14 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 13, y: 10 },
    { id: 2, type: 'medkit', x: 17, y: 7 },
    { id: 3, type: 'gadget', x: 5, y: 12 },
  ],
};
