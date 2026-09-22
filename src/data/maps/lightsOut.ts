import type { MapDef } from '../trainingGrounds';

/**
 * Act 1, mission 1 - "Lights Out" (Riverside).
 *
 * Shape: a flooded street on the west, a chain-link fence running the whole height of the map at x=11, and
 * the substation compound filling the east. Two ways in - the gate at (11,7), which starts closed, and a
 * torn-open breach at (11,12)-(11,13) that is always passable - so the first thing the mission teaches is
 * "pick your entry", not "walk forward".
 *
 * The objective is `sabotage`: both breakers have to be thrown. Breaker A (switch 10) is locked in the
 * control shack behind door 1, so the squad has to open a door to finish the mission; breaker B (switch 11)
 * sits at the back of a transformer pen that is open only to the south, which turns the last few tiles into
 * a deliberate walk past whoever is guarding it.
 *
 * A Jackal sniper sits in the shack with breaker A, but that door starts *open*: sealing a unit behind a
 * door the AI cannot open (it doesn't - see ROADMAP #0c) would also make "eliminate every enemy" unreachable
 * until the player breached, which is the wrong lesson for mission 1. The gate at (11,7) is the closed one,
 * and it is optional.
 */
export const LIGHTS_OUT: MapDef = {
  name: 'Riverside Substation',
  rows: [
    '.....#######.......#####',
    '.....#.....#.hh....#...#',
    '..l..#.....#.hh....#.l.#',
    '.....#.....#.......#...#',
    '.....#..hh.#.......##.##',
    '.....####..#..hh........',
    '...........#..hh...bbb..',
    '..bb....................',
    '..bb....ll.#...hh...hh..',
    '...........#............',
    '..h.....h..#.####...####',
    '...........#.#..#...#..#',
    '.ll..........#..#...#..#',
    '.............#..#...#..#',
    '....h......#.#..#...#..#',
    '...........#............',
  ],
  spawns: {
    player: [['soldier', 1, 13], ['assault', 2, 13], ['medic', 3, 13], ['tank', 1, 14], ['sniper', 2, 15]],
    enemy: [['assault', 17, 6], ['soldier', 14, 9], ['sniper', 21, 3], ['assault', 15, 15], ['soldier', 22, 11]],
  },
  searchPoints: {
    player: [[17, 7], [21, 12], [6, 3]],
    enemy: [[6, 8], [16, 7], [2, 13]],
  },
  startTimeOfDay: 'afternoon',
  startWeather: 'clear',
  enemyProfile: 'easy',
  objective: { type: 'sabotage', interactableIds: [10, 11] },
  interactables: [
    { id: 1, type: 'door', x: 21, y: 4, active: true },
    { id: 2, type: 'door', x: 11, y: 7 },
    { id: 10, type: 'switch', x: 21, y: 1 },
    { id: 11, type: 'switch', x: 22, y: 13 },
    { id: 20, type: 'chest', x: 8, y: 2 },
  ],
  pickups: [
    { id: 1, type: 'ammo', x: 7, y: 7 },
    { id: 2, type: 'medkit', x: 13, y: 15 },
    { id: 3, type: 'gadget', x: 21, y: 15 },
  ],
};
