import { RULES } from '../data/rules';
import type { GameState, Interactable, Pos, Team, Unit } from './types';

/** The enemy unit an 'eliminateTarget' objective names, resolved from its spawn index (spawn order = unit id
 *  order per team - see createGame). */
export function eliminateTargetUnit(s: GameState, enemySpawnIndex: number): Unit | undefined {
  const playerCount = s.map.spawns.player.length;
  return s.units[playerCount + enemySpawnIndex];
}

export const holdRounds = (s: GameState): number => {
  const def = s.objectiveDef;
  return (def?.type === 'hold' ? def.holdRounds : undefined) ?? RULES.objectiveHoldRounds;
};

/**
 * Whether the primary objective is satisfied right now, for the types that resolve outside the hold/capture
 * flow (hold wins through `tickCapture` -> `declareWinner` instead, once its round counter runs out - see
 * `core/state.ts`). Called from `checkWin` after the always-on team-wipeout check.
 */
export function objectiveComplete(s: GameState): boolean {
  const def = s.objectiveDef;
  if (!def) return false;
  switch (def.type) {
    case 'hold':
      return false;
    case 'eliminateTarget': {
      const t = eliminateTargetUnit(s, def.enemySpawnIndex);
      return !!t && !t.alive;
    }
    case 'sabotage':
      return def.interactableIds.length > 0 && def.interactableIds.every((id) => s.interactables.find((i) => i.id === id)?.active === true);
    case 'reach': {
      const zone = new Set(s.objectiveZone.map((p) => `${p.x},${p.y}`));
      const here = s.units.filter((u) => u.team === 'player' && u.alive && !u.downed && zone.has(`${u.x},${u.y}`)).length;
      return here >= def.unitsRequired;
    }
  }
}

/**
 * Positions worth heading toward for this objective, once `team`'s own memory has actually earned them - the
 * AI goal hint each objective type owes its side (3's design sketch). Fog-fair: never returns a position the
 * team hasn't seen for itself. `eliminateTarget` has no positional goal - the AI just fights normally, and the
 * target unit dying (however it happens) ends the mission.
 */
export function objectiveGoalPositions(s: GameState, team: Team): Pos[] {
  const def = s.objectiveDef;
  if (!def) return [];
  const mem = s.memory[team];
  if (def.type === 'hold' || def.type === 'reach') return mem.objectiveSeen ? s.objectiveZone : [];
  if (def.type === 'sabotage') {
    return def.interactableIds
      .map((id) => s.interactables.find((i) => i.id === id))
      // Only switches this team has seen and remembers as not yet thrown: a thrown one is done, and using it
      // again would flip it back (10j - the AI used to keep one as a goal forever).
      .filter((it): it is Interactable => !!it && mem.doors[it.id] === false);
  }
  return [];
}

/**
 * The HUD objective line (3), generated from the objective definition instead of a hard-coded string per
 * mission - covers everything except hold's own "SECURING: ..." in-progress line, which needs a unit display
 * name (ui/hud.ts's `nameOf`, a UI-layer concern) and stays built there.
 */
export function describeObjective(s: GameState): string {
  const def = s.objectiveDef;
  const fallback = 'Or eliminate every enemy.';
  if (!def) return `No objective: eliminate every enemy.`;
  const seenObjective = s.memory.player.objectiveSeen || !s.fogEnabled;
  switch (def.type) {
    case 'hold':
      return seenObjective
        ? `Objective: interact with the terminal, then keep that unit in place for ${holdRounds(s)} rounds. ${fallback}`
        : `Objective: find the terminal (not yet spotted). ${fallback}`;
    case 'eliminateTarget':
      return `Objective: eliminate ${def.label ?? 'the marked target'}. ${fallback}`;
    case 'sabotage': {
      const total = def.interactableIds.length;
      const active = def.interactableIds.filter((id) => s.interactables.find((i) => i.id === id)?.active).length;
      const seen = def.interactableIds.filter((id) => s.memory.player.doors[id] !== undefined || !s.fogEnabled).length;
      return seen === 0
        ? `Objective: find and sabotage ${total} terminals (none spotted yet). ${fallback}`
        : `Objective: sabotage all ${total} terminals (${active}/${total} done). ${fallback}`;
    }
    case 'reach': {
      const zone = new Set(s.objectiveZone.map((p) => `${p.x},${p.y}`));
      const here = s.units.filter((u) => u.team === 'player' && u.alive && !u.downed && zone.has(`${u.x},${u.y}`)).length;
      return seenObjective
        ? `Objective: get ${def.unitsRequired} unit${def.unitsRequired > 1 ? 's' : ''} to the extraction zone at once (${here}/${def.unitsRequired} there now). ${fallback}`
        : `Objective: find the extraction zone (not yet spotted). ${fallback}`;
    }
  }
}
