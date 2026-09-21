/**
 * Mission objective types (3). A `MapDef.objective` (undefined = the legacy default: hold the map's single 'O'
 * tile if it has one, else no primary objective at all) picks one of these; `core/objectives.ts` holds the pure
 * logic that reads them. A full team wipeout always wins/loses regardless of the objective type - see
 * `core/state.ts`'s `checkWin` - so every mission can also always be won "the hard way".
 */
export type ObjectiveType = 'hold' | 'eliminateTarget' | 'sabotage' | 'reach';

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

export type ObjectiveDef = HoldObjectiveDef | EliminateTargetObjectiveDef | SabotageObjectiveDef | ReachObjectiveDef;
