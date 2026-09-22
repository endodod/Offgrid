import type { MapDef } from '../trainingGrounds';

/**
 * Act 1, mission 2 - "Signal Fire" (Riverside).
 *
 * A defend mission, built as a single rooftop: the outer wall is the parapet, and the only ways up are four
 * stairheads - two in the north parapet at x=5 and x=18, one west at (0,4), one east at (23,11). The squad
 * starts around the relay mast in the middle and can start the hold on turn 1; the whole mission is the four
 * rounds after that, with six Jackals coming up the stairs.
 *
 * `holdRounds: 4` (instead of RULES.objectiveHoldRounds' 2) is what makes this a siege rather than a race -
 * two rounds is roughly "get there first", four is "survive what arrives".
 *
 * Midnight + storm is deliberate: it is the mission about a light in the dark, and the accuracy penalty hurts
 * the attackers crossing open roof more than the defenders sitting in parapet cover.
 */
export const SIGNAL_FIRE: MapDef = {
  name: 'Kestrel Street Rooftop',
  rows: [
    '#####.############.#####',
    '#...h..............h...#',
    '#......................#',
    '#..ll....hh....hh...ll.#',
    '.......................#',
    '#....bb..........bb....#',
    '#......h......h........#',
    '#.........O............#',
    '#......h......h........#',
    '#....bb..........bb....#',
    '#......................#',
    '#..ll....hh....hh...ll..',
    '#......................#',
    '#...h..............h...#',
    '#......................#',
    '########################',
  ],
  spawns: {
    player: [['soldier', 10, 8], ['assault', 12, 8], ['medic', 11, 9], ['tank', 11, 6], ['sniper', 13, 6]],
    enemy: [
      ['assault', 5, 1], ['assault', 6, 1], ['soldier', 18, 1],
      ['sniper', 17, 1], ['assault', 1, 4], ['soldier', 22, 11],
    ],
  },
  searchPoints: {
    player: [[5, 1], [18, 1], [1, 4]],
    enemy: [[11, 7], [6, 8], [17, 8]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'stormy',
  enemyProfile: 'standard',
  objective: { type: 'hold', holdRounds: 4 },
  pickups: [
    { id: 1, type: 'ammo', x: 3, y: 7 },
    { id: 2, type: 'ammo', x: 20, y: 7 },
    { id: 3, type: 'medkit', x: 11, y: 11 },
  ],
  interactables: [
    { id: 20, type: 'chest', x: 2, y: 14 },
    { id: 21, type: 'chest', x: 21, y: 2 },
  ],
};
