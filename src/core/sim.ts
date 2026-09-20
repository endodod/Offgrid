import type { MapDef } from '../data/trainingGrounds';
import { RULES } from '../data/rules';
import type { ClassId } from '../data/units';
import { runAiTurn } from './ai';
import { createGame } from './state';
import type { GameOptions, Team } from './types';

export interface UnitResult { team: Team; cls: ClassId; dmgDealt: number; dmgTaken: number; kills: number; survived: boolean }
export interface MatchResult { winner: Team | 'draw'; via: 'elimination' | 'objective' | 'timeout'; turns: number; units: UnitResult[] }

/** Plays one full match with the same AI on both sides. Deterministic for a given (map, seed, options). */
export function playMatch(map: MapDef, seed: number, options: Partial<GameOptions> = {}, maxTurns = RULES.maxTurns): MatchResult {
  const s = createGame(map, seed, options);
  while (!s.winner && s.turn <= maxTurns) {
    runAiTurn(s, s.phase);
    s.events.length = 0; // nobody is reading the log in a simulation
  }
  const winner = s.winner ?? 'draw';
  const loserAlive = s.units.some((u) => u.alive && u.team !== winner);
  return {
    winner,
    via: !s.winner ? 'timeout' : winner !== 'draw' && loserAlive ? 'objective' : 'elimination',
    turns: s.turn,
    units: s.units.map((u) => ({ team: u.team, cls: u.cls, dmgDealt: u.dmgDealt, dmgTaken: u.dmgTaken, kills: u.kills, survived: u.alive })),
  };
}
