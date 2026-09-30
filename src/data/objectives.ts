/**
 * Mission objective types (3). A `MapDef.objective` (undefined = the legacy default: hold the map's single 'O'
 * tile if it has one, else no primary objective at all) picks one of these; `core/objectives.ts` holds the pure
 * logic that reads them. A full team wipeout always wins/loses regardless of the objective type - see
 * `core/state.ts`'s `checkWin` - so every mission can also always be won "the hard way".
 */
export type ObjectiveType = 'hold' | 'eliminateTarget' | 'sabotage' | 'reach' | 'survive' | 'defend' | 'retrieve' | 'eliminateTargets';

interface ObjectiveBase {
  type: ObjectiveType;
}

/** Interact with the objective tile ('O'), then hold position there for `holdRounds` rounds (default RULES.objectiveHoldRounds). */
export interface HoldObjectiveDef extends ObjectiveBase {
  type: 'hold';
  holdRounds?: number;
}

/** Win the moment a specific enemy unit dies, regardless of the rest of its squad. */
export interface EliminateTargetObjectiveDef extends ObjectiveBase {
  type: 'eliminateTarget';
  /** Index into this map's `spawns.enemy` list - spawn order is unit id order (see createGame), so this resolves
   *  to a stable runtime unit without needing a separate id field on Spawn. */
  enemySpawnIndex: number;
  /** Flavor label for the HUD/hover, e.g. "the Jackal leader". Defaults to a generic phrase if omitted. */
  label?: string;
}

/** Win once every listed interactable (door or switch, from `MapDef.interactables`) is active. */
export interface SabotageObjectiveDef extends ObjectiveBase {
  type: 'sabotage';
  interactableIds: number[];
}

/** Win once at least `unitsRequired` living player units are standing on an objective ('O') tile at the same time. */
export interface ReachObjectiveDef extends ObjectiveBase {
  type: 'reach';
  unitsRequired: number;
}

/** Act 2: stay alive until the end of round `rounds` - usually against reinforcement waves (MapDef.reinforcements). */
export interface SurviveObjectiveDef extends ObjectiveBase {
  type: 'survive';
  rounds: number;
}

/**
 * Act 2: keep the enemy off the objective zone ('O' tiles) until the end of round `rounds`. The enemy wins the
 * moment one of its units stands on a zone tile - and, unlike every other type, the enemy AI knows where the zone
 * is from turn one (it is what they came for).
 */
export interface DefendObjectiveDef extends ObjectiveBase {
  type: 'defend';
  rounds: number;
  /** What is being defended, for the HUD: "the pump station". */
  label?: string;
}

/** Act 2: interact with every listed switch (the "intel"), then get `unitsRequired` units onto the extraction
 *  zone ('O' tiles) at the same time. */
export interface RetrieveObjectiveDef extends ObjectiveBase {
  type: 'retrieve';
  interactableIds: number[];
  unitsRequired: number;
  /** What is being retrieved, for the HUD: "the ledgers". */
  label?: string;
}

/** Act 2: several named targets, all of whom have to die (spawn indices, as for eliminateTarget). */
export interface EliminateTargetsObjectiveDef extends ObjectiveBase {
  type: 'eliminateTargets';
  enemySpawnIndices: number[];
  label?: string;
}

export type ObjectiveDef =
  | HoldObjectiveDef | EliminateTargetObjectiveDef | SabotageObjectiveDef | ReachObjectiveDef
  | SurviveObjectiveDef | DefendObjectiveDef | RetrieveObjectiveDef | EliminateTargetsObjectiveDef;

/** Types whose 'O' tiles are a zone (any number of them) rather than a single hold terminal. */
export const ZONE_OBJECTIVES: ObjectiveType[] = ['reach', 'defend', 'retrieve'];

/** Types that name switches the player has to throw. */
export const SWITCH_OBJECTIVES: ObjectiveType[] = ['sabotage', 'retrieve'];

/** The enemy spawn indices an objective marks as targets (eliminateTarget / eliminateTargets), else []. */
export function targetSpawnIndices(def: ObjectiveDef | null | undefined): number[] {
  if (def?.type === 'eliminateTarget') return [def.enemySpawnIndex];
  if (def?.type === 'eliminateTargets') return def.enemySpawnIndices;
  return [];
}
