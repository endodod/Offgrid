import type { ClassId } from './units';
import type { AiProfileId } from './aiProfiles';
import type { TimeOfDayId } from './timeOfDay';
import type { WeatherId } from './weather';

/** [class, x, y, aiProfile?]. A team can field several units of one class. aiProfile overrides the team/mission
 *  default (MapDef.enemyProfile / GameOptions) for this one unit - most useful to mix habitats in one squad
 *  (e.g. one camper covering a doorway while the rest patrol). */
export type Spawn = [ClassId, number, number, AiProfileId?];

export interface MapDef {
  name: string;
  /**
   * '.' floor  '#' wall  'b' bush  'h' high cover  'O' objective
   * 'l' low cover, and '1' '2' '3' = low cover rotated 90 / 180 / 270 degrees (visual only)
   */
  rows: string[];
  spawns: Record<'player' | 'enemy', Spawn[]>;
  /** Waypoints the AI explores when it has no target and has not seen the objective. */
  searchPoints: Record<'player' | 'enemy', [number, number][]>;
  /** Starting conditions for this map; undefined falls back to createGame's default (midday, clear). */
  startTimeOfDay?: TimeOfDayId;
  startWeather?: WeatherId;
  /** The enemy squad's AI habitat/difficulty; undefined falls back to createGame's default ('standard'). */
  enemyProfile?: AiProfileId;
}

// Laid out in the debug map builder (see README) and pasted back from its JSON export.
// Friendly squad starts on the left side, the enemy on the right; the objective terminal is at (22,11).
export const TRAINING_GROUNDS: MapDef = {
  name: 'Training Grounds',
  rows: [
    '.....#.b########........',
    '.....#.bbbb....h........',
    '.....#..................',
    '.............1...3......',
    '..........2.h..#.3......',
    '........##....##........',
    '..lh.hl....3...b###b.h.#',
    '.......h...h...bbbbb.1..',
    '...bb..1..............h.',
    '.........#.....#####....',
    '.ll..hh....3.......#.22.',
    '............h.....b#..O.',
    '.........#.....#.bb#....',
    '.........##..#######...h',
    '..................h.....',
    '..........l....h........',
  ],
  spawns: {
    player: [['soldier', 2, 1], ['assault', 3, 2], ['medic', 2, 8], ['tank', 1, 14], ['sniper', 2, 12]],
    enemy: [['sniper', 23, 15], ['medic', 22, 14], ['assault', 20, 3], ['assault', 18, 2], ['medic', 22, 1]],
  },
  searchPoints: {
    player: [[12, 7], [11, 3], [3, 5], [17, 11]],
    enemy: [[12, 7], [11, 3], [17, 11], [3, 5]],
  },
};
