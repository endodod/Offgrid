export type GadgetId = 'scan' | 'adrenaline' | 'grenade' | 'cover' | 'medkit';

export interface GadgetDef {
  name: string;
  /** none = fires immediately, visible = a visible tile, any = any map tile, ally = a wounded friendly unit */
  target: 'none' | 'visible' | 'any' | 'ally';
  range?: number;
  radius?: number;
  damage?: number;
  durationTurns?: number;
  moveBonus?: number; // extra tiles for the next move
  actionsRestored?: number; // actions handed back on use (the use itself costs 1)
  blurb: string;
}

export const GADGETS: Record<GadgetId, GadgetDef> = {
  scan: {
    name: 'Scan', target: 'any', radius: 5, durationTurns: 2,
    blurb: 'Reveals fog and hidden units in a radius for 2 turns, ignoring range and LOS.',
  },
  adrenaline: {
    name: 'Adrenaline', target: 'none', moveBonus: 4, actionsRestored: 2,
    blurb: 'Costs 1 action but restores 2 (net +1 action), and your next move this turn can go 4 tiles further.',
  },
  grenade: {
    name: 'Grenade', target: 'visible', range: 5, radius: 1, damage: 3,
    blurb: 'Blast (3x3) hurts everyone, incl. allies. High cover -> low, low cover destroyed.',
  },
  cover: {
    name: 'Cover', target: 'visible', range: 2,
    blurb: 'Low cover -> high. Empty tile -> low cover. Rotate the piece with Q / mouse wheel.',
  },
  medkit: {
    name: 'Medkit', target: 'ally', range: 2,
    blurb: 'Heals a wounded friendly unit within 2 tiles (or itself) to full HP.',
  },
};
