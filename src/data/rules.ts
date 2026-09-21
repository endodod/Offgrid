// Global rule tunables. Placeholder numbers - tweak freely.
export type ObjectiveCapture = 'player' | 'both' | 'none';

export const RULES = {
  actionsPerTurn: 2,
  coverPenalty: { low: 20, high: 40 },
  hitClamp: { min: 5, max: 95 },
  highCoverBlocksLos: false, // false: only walls block line of sight, so units can shoot (and see) over high cover
  bushRevealRange: 2, // an observer this close (tiles) sees units hiding in bushes
  medkitsPerUnit: 2,
  medkitHeal: 3,
  objectiveHoldRounds: 2, // after interacting, the unit must stay put this many rounds
  bleedOutRounds: 3, // a downed unit dies for good after this many of its own team's phases, if not revived
  reviveHp: 4, // HP a downed unit comes back with
  gadgetUsesPerMission: 3,
  gadgetCooldownTurns: 2,
  objectiveCapture: 'player' as ObjectiveCapture, // who may win by interacting: player only (spec), both teams, or nobody
  maxTurns: 40, // only used by the simulator (draw after this many rounds)
};
