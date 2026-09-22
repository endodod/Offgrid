import { building, coverPairs, field, hRun, pts, put, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 2 of 5 - "Signal Fire". Objective: `hold`, 4 rounds.
 *
 * A defend mission, built as one rooftop complex. The outer wall is the parapet; two internal parapets split
 * the roof into a north band, a middle band and a south band, each connected only through numbered gaps. The
 * relay mast sits in the middle band and the squad starts around it, so there is no approach phase at all -
 * the hold can begin on turn one and the entire mission is the four rounds after that.
 *
 * `holdRounds: 4` instead of the global default of 2 is what turns "hold" from a race into a siege. Two
 * rounds is "get there first"; four is "survive what arrives". Nine attackers coming through seven gaps from
 * two directions is the pressure that number is calibrated against.
 *
 * Midnight + storm is not set dressing: halved vision and a -20 accuracy penalty hurt the side crossing open
 * roof far more than the side sitting behind a parapet, which is the only reason a 5-against-9 defence is
 * winnable. It also means the mission about a light in the dark is played in the dark.
 */
function compose(): string[] {
  const g = field();
  hRun(g, 0, 0, 48, '#');
  hRun(g, 0, 31, 48, '#');
  vRun(g, 0, 0, 32, '#');
  vRun(g, 47, 0, 32, '#');

  // Internal parapets. The gaps are the whole mission: everything that reaches the mast comes through one.
  hRun(g, 1, 10, 46, '#');
  for (const x of [6, 20, 34, 44]) put(g, x, 10, '.');
  hRun(g, 1, 21, 46, '#');
  for (const x of [10, 24, 40]) put(g, x, 21, '.');

  // Stair heads: four huts the Jackals come up through, each open to its own band.
  building(g, 2, 2, 6, 6, [[5, 7]]);
  building(g, 40, 2, 6, 6, [[42, 7]]);
  building(g, 2, 24, 6, 6, [[5, 24]]);
  building(g, 40, 24, 6, 6, [[42, 24]]);

  // The mast, and the plant it sits among.
  put(g, 24, 16, 'O');
  pts(g, [[22, 14], [23, 14], [25, 14], [26, 14], [22, 18], [23, 18], [25, 18], [26, 18]], 'h'); // AC units
  coverPairs(g, 16, [18, 29]);                       // ducting either side of the mast
  pts(g, [[20, 12], [28, 12], [20, 20], [28, 20]], 'h');

  // Roof clutter in the outer bands: enough to advance behind, never enough to sit in.
  coverPairs(g, 4, [14, 22, 30]);
  coverPairs(g, 8, [11, 25, 36]);
  pts(g, [[17, 6], [18, 6], [31, 6], [32, 6]], 'h');
  pts(g, [[12, 2], [13, 2], [35, 3], [36, 3]], 'b'); // tarpaulins
  coverPairs(g, 26, [13, 21, 33]);
  coverPairs(g, 29, [17, 28]);
  pts(g, [[10, 27], [11, 27], [36, 27], [37, 27]], 'h');
  pts(g, [[24, 24], [25, 24], [24, 28], [8, 23]], 'b');
  return toRows(g);
}

// Sim, 60 AI-vs-AI matches on this map's own profile (`npm run sim -- --map signal-fire --objective player`):
// player 92% / enemy 8%, 92% of wins by holding the relay, ~6 turns.
export const SIGNAL_FIRE: MapDef = {
  name: 'Kestrel Street Rooftops',
  rows: compose(),
  spawns: {
    player: [['soldier', 23, 15], ['assault', 25, 15], ['medic', 24, 17], ['tank', 23, 17], ['sniper', 25, 17]],
    enemy: [
      ['assault', 5, 8], ['soldier', 5, 5], ['assault', 42, 8], ['sniper', 42, 5],
      ['soldier', 5, 23], ['assault', 42, 23], ['sniper', 20, 3],
    ],
  },
  searchPoints: {
    player: [[6, 12], [34, 12], [10, 19], [40, 19]],
    enemy: [[24, 15], [20, 11], [24, 20], [34, 11]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'stormy',
  enemyProfile: 'standard',
  objective: { type: 'hold', holdRounds: 4 },
  interactables: [
    { id: 20, type: 'chest', x: 4, y: 4 },
    { id: 21, type: 'chest', x: 43, y: 4 },
    { id: 22, type: 'chest', x: 4, y: 27 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 14, y: 16 },
    { id: 2, type: 'ammo', x: 33, y: 16 },
    { id: 3, type: 'medkit', x: 24, y: 12 },
    { id: 4, type: 'medkit', x: 24, y: 19 },
    { id: 5, type: 'gadget', x: 8, y: 16 },
    { id: 6, type: 'gadget', x: 39, y: 16 },
  ],
};
