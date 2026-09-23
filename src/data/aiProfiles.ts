/**
 * Habitat (behavioural pattern) and difficulty knobs for `core/ai.ts`. Placeholder numbers - tweak freely.
 * Difficulty is expressed as decision quality (hesitation, self-preservation), not stat multipliers, per the
 * roadmap's own preference: a harder mission should feel like a smarter enemy, not a bullet sponge.
 */
export type Habitat = 'patrol' | 'camper' | 'ambush' | 'hold';

export interface AiProfileDef {
  name: string;
  /** patrol: roams search waypoints and advances readily. camper: holds a position once it has one, only
   *  repositions when it has no shot at all, ignores search waypoints while idle. ambush: does not move at all
   *  (not even toward the objective) until it has a visible target; once it does, it fights like a patrol.
   *  hold (16, the squad's "defend"): never goes looking; in a fight it only repositions within `leash` tiles of
   *  where it stands, and never advances on an enemy it can't shoot - it overwatches instead. */
  habitat: Habitat;
  /** What an idle unit (and, for 'objective', a fighting one) is really after (16).
   *  objective: the objective first, and in a fight it moves toward it while shooting from wherever it can.
   *  explore: loot it knows about and the search waypoints before chasing ghosts. */
  focus?: 'objective' | 'explore';
  /** hold only: how many tiles of movement a repositioning may cost. */
  leash?: number;
  /** 0..1, rolled from the seeded RNG each decision: below this, the unit hesitates - it holds/overwatches
   *  instead of taking its best move or shot. 1 = never hesitates (today's behaviour, the regression baseline). */
  reactionChance: number;
  /** 0..1 fraction of max HP, or undefined to never retreat (today's behaviour). Below this, and if a visible
   *  enemy is in range, it falls back toward the tile furthest from the nearest one instead of fighting on. */
  retreatBelowHp?: number;
  /** When idle (patrol/camper only - ambush never moves regardless), chase a seen objective ahead of a spotted
   *  ghost instead of the other way around - finishing the mission over finishing a fight it doesn't have to. */
  prioritizeObjective?: boolean;
  blurb: string;
}

export type AiProfileId = 'standard' | 'easy' | 'hard' | 'camper' | 'ambush' | 'friendly' | 'explore' | 'rush' | 'defend';
/** Enemy profiles, as the map builder and the debug panel offer them. */
export const PROFILE_ORDER: AiProfileId[] = ['standard', 'easy', 'hard', 'camper', 'ambush', 'friendly'];
/** Auto-run's orders for the player's own squad (16), as the mode picker beside the Auto-run button offers them. */
export const SQUAD_ORDERS: AiProfileId[] = ['friendly', 'explore', 'rush', 'defend'];

export const AI_PROFILES: Record<AiProfileId, AiProfileDef> = {
  standard: {
    name: 'Standard', habitat: 'patrol', reactionChance: 1,
    blurb: 'Seeks cover, pushes toward contact, patrols search waypoints when idle. The regression baseline.',
  },
  easy: {
    name: 'Easy', habitat: 'patrol', reactionChance: 0.5,
    blurb: 'Same as Standard, but hesitates about half the time instead of taking its best move or shot.',
  },
  hard: {
    name: 'Hard', habitat: 'patrol', reactionChance: 1, retreatBelowHp: 0.3,
    blurb: 'Never hesitates, and falls back rather than fighting to the death once badly hurt.',
  },
  camper: {
    name: 'Camper', habitat: 'camper', reactionChance: 1,
    blurb: 'Holds a position once it has one: only repositions when it currently has no shot at all.',
  },
  ambush: {
    name: 'Ambush', habitat: 'ambush', reactionChance: 1,
    blurb: 'Stays completely still and hidden until it gets a line on an enemy, then fights normally.',
  },
  friendly: {
    name: 'Friendly (auto-run)', habitat: 'patrol', reactionChance: 1, retreatBelowHp: 0.5, prioritizeObjective: true,
    blurb: 'Plays a squad on its own: pushes for the objective over chasing a fight, and falls back sooner than a losing one is worth.',
  },
  // ---- squad orders for auto-run (16) ----
  explore: {
    name: 'Explore', habitat: 'patrol', reactionChance: 1, retreatBelowHp: 0.5, focus: 'explore',
    blurb: 'Sweeps the map: supply caches and chests it knows about, then the search waypoints. Fights what it meets, falls back when hurt.',
  },
  rush: {
    name: 'Rush objective', habitat: 'patrol', reactionChance: 1, focus: 'objective',
    blurb: 'Straight for the objective: moves toward it every turn, shooting from wherever it ends up, and never falls back.',
  },
  defend: {
    name: 'Defend position', habitat: 'hold', reactionChance: 1, leash: 2,
    blurb: 'Holds where it stands: shifts at most 2 tiles for a better shot or cover, otherwise overwatches. Never goes looking.',
  },
};
