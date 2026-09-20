import { CLASSES } from '../data/units';
import { GADGETS } from '../data/gadgets';
import type { GameEvent, GameState, Unit } from '../core/types';

export interface LogLine { text: string; kind: 'player' | 'enemy' | 'system' | 'fog' }

export const nameOf = (u: Unit) => `${u.team === 'enemy' ? 'Enemy ' : ''}${CLASSES[u.cls].name}`;

/** Turns an engine event into a log line. Events the player could not see are hidden (fog applies to the log too). */
export function describe(s: GameState, e: GameEvent): LogLine | null {
  const who = (id: number) => nameOf(s.units[id]);
  const kind = (id: number): LogLine['kind'] => s.units[id].team;
  if (e.t === 'phase') return { kind: 'system', text: `— Turn ${e.turn}: ${e.team} phase —` };
  if (e.t === 'end') return { kind: 'system', text: e.winner === 'player' ? 'VICTORY' : e.winner === 'enemy' ? 'DEFEAT' : 'DRAW' };
  if (e.t === 'shot' && !e.seen) return e.shot === 1 ? { kind: 'fog', text: 'Gunfire echoes from the fog.' } : null;
  if (!e.seen) return null;
  switch (e.t) {
    case 'move': return { kind: kind(e.unit), text: `${who(e.unit)} moves (${e.from.x},${e.from.y}) -> (${e.to.x},${e.to.y})` };
    case 'shot': {
      const burst = e.shots > 1 ? ` [${e.shot}/${e.shots}]` : '';
      const result = e.hit ? `HIT for ${e.damage}` : 'MISS';
      return { kind: kind(e.attacker), text: `${e.overwatch ? '[OVERWATCH] ' : ''}${who(e.attacker)} shoots ${who(e.target)}${burst}: ${result} (${e.chance}%)` };
    }
    case 'damage': return { kind: kind(e.target), text: `${who(e.target)} takes ${e.amount} from the blast` };
    case 'died': return { kind: 'system', text: `${who(e.unit)} is down!` };
    case 'reload': return { kind: kind(e.unit), text: `${who(e.unit)} reloads` };
    case 'exposed': return { kind: kind(e.unit), text: `${who(e.unit)} is exposed in the bush until next turn` };
    case 'overwatch': return { kind: kind(e.unit), text: `${who(e.unit)} goes on overwatch` };
    case 'heal': return { kind: kind(e.unit), text: `${who(e.unit)} patches up ${who(e.target)} (+${e.amount} HP)` };
    case 'gadget': return { kind: kind(e.unit), text: `${who(e.unit)} uses ${GADGETS[e.gadget].name}${e.target ? ` at (${e.target.x},${e.target.y})` : ''}` };
    case 'cover': return { kind: 'system', text: `Cover at (${e.at.x},${e.at.y}): ${e.from ?? 'none'} -> ${e.to ?? 'destroyed'}` };
    case 'objective': return { kind: kind(e.unit), text: `${who(e.unit)} activates the objective!` };
    case 'capture':
      if (e.status === 'start') return { kind: kind(e.unit), text: `${who(e.unit)} is securing the objective - hold position for ${e.roundsLeft} rounds` };
      if (e.status === 'progress') return { kind: kind(e.unit), text: `Objective: ${e.roundsLeft} more round${e.roundsLeft > 1 ? 's' : ''} to hold` };
      return { kind: 'system', text: `${who(e.unit)} lost the objective hold!` };
  }
}
