import type { ClassId } from './units';

/** [class, x, y]. A team can field several units of one class. */
export type Spawn = [ClassId, number, number];

export interface MapDef {
  name: string;
  /**
   * '.' floor  '#' wall  'b' bush  'h' high cover  'O' objective
   * 'l' low cover, and '1' '2' '3' = low cover rotated 90 / 180 / 270 degrees (visual variety only)
   */
  rows: string[];
  spawns: Record<'player' | 'enemy', Spawn[]>;
  /** Waypoints the AI explores when it has no target and has not seen the objective. */
  searchPoints: Record<'player' | 'enemy', [number, number][]>;
}

// Test features (x,y):
//  - Sniper lane:       bottom rows y=14/15, straight for 24 tiles (range 12)
//  - Street crossing:   open plaza x10-14, y7-8 (overwatch)
//  - Cover rows:        y=10 (base), y=6 (bush edge), barricades at x=7, lane
//  - Bush field:        x2-6, y1-4 (+ small patch by x13-14, y10-11)
//  - Scan room:         walled room x16-18, y10-12, 2-wide door (15,10-11)
//  - Wall with gaps:    enemy wall y=6 (gap x19-22), player-side wall x=9 (gap y10-11)
//  - Courtyard:         x9-14, y1-4, objective at (11,2), wide openings W/S/E
export const TRAINING_GROUNDS: MapDef = {
  name: 'Training Grounds',
  rows: [
    '........########........',
    '..bbbbb.#...............',
    '..bbbbb....O............',
    '..bbbbb......1...2.....3',
    '..bbbbb...2.h..#..h..1..',
    '........##....##........',
    '..1h2h3.........###....#',
    '.......h.1.........3.l..',
    '.......1.......h......h.',
    '.........#.....#####....',
    '.1l..hh....3..b....#....',
    '............hbb....#....',
    '.........#.....#.2.#....',
    '.........##..#######....',
    '........................',
    '..........l....h........',
  ],
  spawns: {
    player: [['sniper', 1, 14], ['assault', 4, 14], ['soldier', 2, 12], ['medic', 3, 13], ['tank', 4, 12]],
    enemy: [['soldier', 18, 2], ['soldier', 20, 3], ['soldier', 22, 1]],
  },
  searchPoints: {
    player: [[12, 7], [11, 3], [3, 5], [17, 11]],
    enemy: [[12, 7], [11, 3], [17, 11], [3, 5]],
  },
};
