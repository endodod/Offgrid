import { RULES } from '../data/rules';
import { targetSpawnIndices } from '../data/objectives';
import type { GameState, Interactable, Pos, Team, Unit } from './types';

/** The enemy unit an 'eliminateTarget' objective names, resolved from its spawn index (spawn order = unit id
 *  order per team - see createGame). */
export function eliminateTargetUnit(s: GameState, enemySpawnIndex: number): Unit | undefined {
  const playerCount = s.map.spawns.player.length;
  return s.units[playerCount + enemySpawnIndex];
}

/** Every enemy unit the objective marks as a target (eliminateTarget / eliminateTargets), dead ones included. */
export function targetUnits(s: GameState): Unit[] {
  return targetSpawnIndices(s.objectiveDef).map((i) => eliminateTargetUnit(s, i)).filter((u): u is Unit => !!u);
}

/** Whether `u` is one of the objective's named targets - the renderer crowns them, the HUD names them. */
export const isTarget = (s: GameState, u: Unit): boolean => u.team === 'enemy' && targetUnits(s).some((t) => t.id === u.id);

const switchesDone = (s: GameState, ids: number[]): number =>
  ids.filter((id) => s.interactables.find((i) => i.id === id)?.active === true).length;

/** Living, standing units of `team` on the objective zone right now. */
export function unitsOnZone(s: GameState, team: Team): number {
  const zone = new Set(s.objectiveZone.map((p) => `${p.x},${p.y}`));
  return s.units.filter((u) => u.team === team && u.alive && !u.downed && zone.has(`${u.x},${u.y}`)).length;
}

/**
 * How many units a reach/retrieve extraction needs right now: the mission's number, or everyone still alive
 * if the squad has fallen below it (downed units count - they can be revived). Without the cap a squad that
 * lost people could no longer win by the objective at all, only by a wipeout.
 */
export function unitsNeeded(s: GameState, required: number): number {
  const alive = s.units.filter((u) => u.team === 'player' && u.alive).length;
  return Math.max(1, Math.min(required, alive));
}

/** survive / defend: the round the mission is won at the start of (the enemy's phase of `rounds` is the last one). */
export function roundsLeft(s: GameState): number | null {
  const def = s.objectiveDef;
  if (def?.type !== 'survive' && def?.type !== 'defend') return null;
  return Math.max(0, def.rounds + 1 - s.turn);
}

/**
 * 'defend' is the one objective the enemy can win by: still standing on the zone when their own next phase
 * begins. Reaching it is not enough - the squad always gets one phase to kill or drive off whoever got there,
 * the same grace the hold objective gives a capture. Checked at that phase change (core/state.ts endTurn).
 */
export function objectiveFailed(s: GameState): boolean {
  return s.objectiveDef?.type === 'defend' && s.phase === 'enemy' && unitsOnZone(s, 'enemy') > 0;
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
    case 'reach':
      return unitsOnZone(s, 'player') >= unitsNeeded(s, def.unitsRequired);
    case 'survive':
    case 'defend':
      return s.phase === 'player' && s.turn > def.rounds;
    case 'retrieve':
      return switchesDone(s, def.interactableIds) === def.interactableIds.length && unitsOnZone(s, 'player') >= unitsNeeded(s, def.unitsRequired);
    case 'eliminateTargets': {
      const ts = targetUnits(s);
      return ts.length > 0 && ts.every((t) => !t.alive);
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
  // The defenders' zone is what the attackers came for: they know where it is. The squad knows too - it is
  // standing next to it.
  if (def.type === 'defend') return s.objectiveZone;
  if (def.type === 'retrieve') {
    if (team !== 'player') return mem.objectiveSeen ? s.objectiveZone : [];
    const intel = def.interactableIds
      .map((id) => s.interactables.find((i) => i.id === id))
      .filter((it): it is Interactable => !!it && mem.doors[it.id] === false);
    if (intel.length) return intel;
    const allDone = switchesDone(s, def.interactableIds) === def.interactableIds.length;
    return allDone && mem.objectiveSeen ? s.objectiveZone : [];
  }
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
      const here = unitsOnZone(s, 'player');
      const need = unitsNeeded(s, def.unitsRequired);
      return seenObjective
        ? `Objective: get ${need} unit${need > 1 ? 's' : ''} to the extraction zone at once (${here}/${need} there now). ${fallback}`
        : `Objective: find the extraction zone (not yet spotted). ${fallback}`;
    }
    case 'survive': {
      const left = roundsLeft(s) ?? 0;
      return `Objective: survive until the end of round ${def.rounds} (${left} to go). ${fallback}`;
    }
    case 'defend': {
      const left = roundsLeft(s) ?? 0;
      return `Objective: keep every enemy off ${def.label ?? 'the marked zone'} until the end of round ${def.rounds} (${left} to go). An attacker still on it when their turn begins wins it for them. ${fallback}`;
    }
    case 'retrieve': {
      const total = def.interactableIds.length;
      const done = switchesDone(s, def.interactableIds);
      const what = def.label ?? 'the intel';
      const need = unitsNeeded(s, def.unitsRequired);
      if (done < total) return `Objective: recover ${what} (${done}/${total}), then extract ${need} unit${need > 1 ? 's' : ''}. ${fallback}`;
      const here = unitsOnZone(s, 'player');
      return seenObjective
        ? `Objective: ${what} secured - get ${need} unit${need > 1 ? 's' : ''} to the extraction zone at once (${here}/${need} there now). ${fallback}`
        : `Objective: ${what} secured - find the extraction zone (not yet spotted). ${fallback}`;
    }
    case 'eliminateTargets': {
      const ts = targetUnits(s);
      const down = ts.filter((t) => !t.alive).length;
      return `Objective: eliminate ${def.label ?? 'every marked target'} (${down}/${ts.length} dead). ${fallback}`;
    }
  }
}
