import { building, coverPairs, field, hRun, pts, put, toRows, vRun } from '../compose';
import type { MapDef } from '../../trainingGrounds';

/**
 * Riverside, mission 2 of 5 - "Signal Fire". Objective: `hold`, 5 rounds. 30x30 (19: one square rooftop).
 *
 * A defend mission, built as one rooftop. The outer wall is the parapet; two internal parapets split the roof
 * into a north band, a middle band and a south band, connected only through five gaps. The relay mast sits in
 * the middle band and the squad starts around it, so there is no approach phase at all - the hold can begin on
 * turn one and the entire mission is the five rounds after that.
 *
 * `holdRounds: 5` instead of the global default of 2 is what turns "hold" from a race into a siege. Six
 * attackers come up four stairwells, from both sides at once; on a roof this size they are there by round two.
 * Tuned in the sim (Balanced squad): 4 rounds was 95% wins, a seventh attacker 55%, 5 rounds with six 75%.
 *
 * Midnight + storm is not set dressing: halved vision and a -20 accuracy penalty hurt the side crossing open
 * roof far more than the side sitting behind a parapet, which is what makes the defence winnable.
 */
function compose(): string[] {
  const W = 30, H = 30;
  const g = field(W, H);
  hRun(g, 0, 0, W, '#');
  hRun(g, 0, H - 1, W, '#');
  vRun(g, 0, 0, H, '#');
  vRun(g, W - 1, 0, H, '#');

  // Internal parapets. The gaps are the whole mission: everything that reaches the mast comes through one.
  hRun(g, 1, 9, W - 2, '#');
  for (const x of [5, 15, 24]) put(g, x, 9, '.');
  hRun(g, 1, 20, W - 2, '#');
  for (const x of [8, 21]) put(g, x, 20, '.');

  // Stair heads: four huts the Jackals come up through, each open to its own band.
  building(g, 2, 2, 5, 5, [[4, 6]]);
  building(g, 23, 2, 5, 5, [[25, 6]]);
  building(g, 2, 23, 5, 5, [[4, 23]]);
  building(g, 23, 23, 5, 5, [[25, 23]]);

  // The mast, and the plant it sits among.
  put(g, 15, 14, 'O');
  pts(g, [[13, 12], [14, 12], [16, 12], [17, 12], [13, 16], [14, 16], [16, 16], [17, 16]], 'h'); // AC units
  coverPairs(g, 14, [9, 20]);                       // ducting either side of the mast

  // Roof clutter in the outer bands: enough to advance behind, never enough to sit in.
  coverPairs(g, 4, [10, 17]);
  coverPairs(g, 7, [8, 20]);
  pts(g, [[13, 3], [14, 3]], 'h');
  pts(g, [[10, 2], [19, 2]], 'b'); // tarpaulins
  coverPairs(g, 25, [9, 18]);
  coverPairs(g, 27, [13]);
  pts(g, [[15, 22], [15, 27], [11, 11], [19, 18]], 'b');
  return toRows(g);
}

export const SIGNAL_FIRE: MapDef = {
  name: 'Kestrel Street Rooftops',
  rows: compose(),
  spawns: {
    player: [['soldier', 14, 13], ['assault', 16, 13], ['medic', 15, 15], ['tank', 14, 15], ['sniper', 16, 15]],
    enemy: [
      ['assault', 4, 4], ['sniper', 25, 4], ['soldier', 26, 5],
      ['assault', 4, 25], ['soldier', 25, 25], ['sniper', 14, 2],
    ],
  },
  searchPoints: {
    player: [[5, 10], [24, 10], [8, 19], [21, 19]],
    enemy: [[15, 13], [15, 10], [15, 19], [24, 10]],
  },
  startTimeOfDay: 'midnight',
  startWeather: 'stormy',
  enemyProfile: 'standard',
  objective: { type: 'hold', holdRounds: 5 },
  interactables: [
    { id: 20, type: 'chest', x: 3, y: 3 },
    { id: 21, type: 'chest', x: 26, y: 3 },
    { id: 22, type: 'chest', x: 3, y: 26 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 8, y: 13 },
    { id: 2, type: 'ammo', x: 22, y: 13 },
    { id: 3, type: 'medkit', x: 15, y: 11 },
    { id: 4, type: 'medkit', x: 15, y: 18 },
    { id: 5, type: 'gadget', x: 4, y: 14 },
    { id: 6, type: 'gadget', x: 26, y: 14 },
  ],
};
