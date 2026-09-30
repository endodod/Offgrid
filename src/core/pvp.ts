import { CLASSES } from '../data/units';
import { RULES } from '../data/rules';
import { endTurn } from './state';
import { refreshVision } from './vision';
import { otherTeam, type GameState, type Team } from './types';

/**
 * Hotseat versus (two people, one screen). The engine, the renderer and the HUD all think in terms of 'player'
 * (the side being controlled, whose fog is drawn) and 'enemy' (the other side). Rather than teach every one of
 * them about a second human, a versus game *flips* the state between turns: every team label, and everything
 * kept per team, is swapped, so whoever is about to move is always 'player'. Fog, selection, undo, the log's
 * "seen" filter and the objective line then all work from that side's point of view with no changes.
 *
 * Side 1 starts as 'player'. `side` in `VersusState` records who 'player' currently is.
 */

/** Both squads start equal: gadgets and medkits are normally a player-only thing. */
export function prepareVersus(s: GameState): void {
  for (const u of s.units) {
    if (u.team !== 'enemy') continue;
    u.gadget = { id: CLASSES[u.cls].gadget, uses: RULES.gadgetUsesPerMission, cooldown: 0 };
    u.medkits = RULES.medkitsPerUnit;
  }
  s.objectiveDef = null; // last squad standing
  s.objectiveZone = [];
  s.objective = null;
}

/** Swap every team label and everything kept per team. Phase flips with it. */
export function flipTeams(s: GameState): void {
  const swap = (t: Team): Team => otherTeam(t);
  for (const u of s.units) u.team = swap(u.team);
  s.phase = swap(s.phase);
  [s.memory.player, s.memory.enemy] = [s.memory.enemy, s.memory.player];
  [s.visible.player, s.visible.enemy] = [s.visible.enemy, s.visible.player];
  [s.seenUnits.player, s.seenUnits.enemy] = [s.seenUnits.enemy, s.seenUnits.player];
  [s.aiProfiles.player, s.aiProfiles.enemy] = [s.aiProfiles.enemy, s.aiProfiles.player];
  if (s.capture) s.capture.team = swap(s.capture.team);
  for (const sc of s.scans) sc.team = swap(sc.team);
  if (s.winner === 'player' || s.winner === 'enemy') s.winner = swap(s.winner);
}

/**
 * Ends the current side's turn: the engine's own end of turn (which starts the other team's phase - resets its
 * actions, ticks its bleed-out, checks for a winner), then the flip, so the other side is 'player'. A round is
 * both sides' turns, so the turn counter goes up when side 1 is back.
 */
export function endVersusTurn(s: GameState, side: 1 | 2): 1 | 2 {
  endTurn(s);
  return seatNextSide(s, side);
}

/** The second half of `endVersusTurn`, for a caller that already performed the engine's end of turn itself
 *  (ui/session.ts goes through `perform`, so the log and animations see it). */
export function seatNextSide(s: GameState, side: 1 | 2): 1 | 2 {
  flipTeams(s);
  const next: 1 | 2 = side === 1 ? 2 : 1;
  if (next === 1) s.turn++;
  refreshVision(s);
  return next;
}

/** Which side won, given the side currently seated as 'player'. */
export function versusWinner(s: GameState, side: 1 | 2): 1 | 2 | 'draw' | null {
  if (!s.winner) return null;
  if (s.winner === 'draw') return 'draw';
  return s.winner === 'player' ? side : side === 1 ? 2 : 1;
}
