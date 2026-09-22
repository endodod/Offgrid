import type { MapDef } from '../trainingGrounds';

/**
 * Act 1, mission 3 - "Supply Run: Market Row".
 *
 * A west-to-east run down a covered market street: shopfronts line the top and bottom (each with a single
 * doorway onto the street), market stalls make the low/high cover islands in the middle, and the extraction
 * zone is the loading bay in the east corner.
 *
 * `reach` with `unitsRequired: 3` rather than 5 - the mission is "get the crates out", not "get everyone
 * out", so losing someone on the way is a setback and not an automatic restart. The crates themselves are
 * ordinary pickups: nothing forces the player to take them, they are just the reason to leave the straight
 * line between the spawn and the exit.
 *
 * The shopfronts are where the loot is (both chests) and where two of the five Jackals are sitting, so the
 * detour is a real decision rather than free money.
 */
export const MARKET_ROW: MapDef = {
  name: 'Market Row',
  rows: [
    '#####.####.#####.#####..',
    '#...#.#..#.#...#.#...#..',
    '#...#.#..#.#...#.#...#..',
    '##.##.#..#.##.##.##.##..',
    '........................',
    '..ll...hh....ll...hh....',
    '........................',
    '.b...ll....b...ll.....OO',
    '.....................OOO',
    '.b...hh....b...hh.....OO',
    '........................',
    '...ll......hh....ll.....',
    '##.##.#..#.##.##.##.##..',
    '#...#.#..#.#...#.#...#..',
    '#...#.#..#.#...#.#...#..',
    '#####.####.#####.#####..',
  ],
  spawns: {
    player: [['soldier', 1, 6], ['assault', 2, 6], ['medic', 1, 8], ['tank', 1, 10], ['sniper', 2, 10]],
    enemy: [['assault', 12, 4], ['soldier', 16, 6], ['sniper', 19, 10], ['assault', 13, 13], ['soldier', 19, 1]],
  },
  searchPoints: {
    player: [[11, 8], [19, 8], [8, 4]],
    enemy: [[11, 8], [4, 8], [18, 8]],
  },
  startTimeOfDay: 'morning',
  startWeather: 'rain',
  enemyProfile: 'easy',
  objective: { type: 'reach', unitsRequired: 3 },
  interactables: [
    { id: 20, type: 'chest', x: 12, y: 2 },
    { id: 21, type: 'chest', x: 8, y: 13 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 7, y: 7 },
    { id: 2, type: 'medkit', x: 13, y: 8 },
    { id: 3, type: 'ammo', x: 18, y: 4 },
    { id: 4, type: 'gadget', x: 6, y: 11 },
  ],
};
