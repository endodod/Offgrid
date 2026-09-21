/**
 * Habitat (behavioural pattern) and difficulty knobs for `core/ai.ts`. Placeholder numbers - tweak freely.
 * Difficulty is expressed as decision quality (hesitation, self-preservation), not stat multipliers, per the
 * roadmap's own preference: a harder mission should feel like a smarter enemy, not a bullet sponge.
 */
export type Habitat = 'patrol' | 'camper' | 'ambush';

export interface AiProfileDef {
  name: string;
  /** patrol: roams search waypoints and advances readily. camper: holds a position once it has one, only
   *  repositions when it has no shot at all, ignores search waypoints while idle. ambush: does not move at all
   *  (not even toward the objective) until it has a visible target; once it does, it fights like a patrol. */
  habitat: Habitat;
  /** 0..1, rolled from the seeded RNG each decision: below this, the unit hesitates - it holds/overwatches
   *  instead of taking its best move or shot. 1 = never hesitates (today's behaviour, the regression baseline). */
  reactionChance: number;
  /** 0..1 fraction of max HP, or undefined to never retreat (today's behaviour). Below this, and if a visible
   *  enemy is in range, it falls back toward the tile furthest from the nearest one instead of fighting on. */
  retreatBelowHp?: number;
  blurb: string;
}

export type AiProfileId = 'standard' | 'easy' | 'hard' | 'camper' | 'ambush';
export const PROFILE_ORDER: AiProfileId[] = ['standard', 'easy', 'hard', 'camper', 'ambush'];

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
};
