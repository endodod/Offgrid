import { CLASSES } from '../data/units';
import { GADGETS } from '../data/gadgets';
import { ITEMS } from '../data/items';
import { ARMOR } from '../data/armor';
import { EQUIPMENT } from '../data/equipment';
import type { GameEvent, GameState, Unit } from '../core/types';

/** `at`: when the line may be shown (performance.now() time) - event playback holds lines until their moment (10d). */
export interface LogLine { text: string; kind: 'player' | 'enemy' | 'system' | 'fog'; at?: number }

export const nameOf = (u: Unit) => u.name ? `${u.name.split(' ')[0]} (${CLASSES[u.cls].name})` : `${u.team === 'enemy' ? 'Enemy ' : ''}${CLASSES[u.cls].name}`;

/** Turns an engine event into a log line. Events the player could not see are hidden (fog applies to the log too). */
export function describe(s: GameState, e: GameEvent): LogLine | null {
  const who = (id: number) => nameOf(s.units[id]);
  const kind = (id: number): LogLine['kind'] => s.units[id].team;
  if (e.t === 'phase') return { kind: 'system', text: `— Turn ${e.turn}: ${e.team} phase —` };
  if (e.t === 'reinforce') return { kind: 'system', text: `Enemy reinforcements have arrived (${e.units.length})!` };
  if (e.t === 'alert') return e.seen ? { kind: 'system', text: `Hostiles alerted: ${e.units.length} of them are awake now.` } : null;
  if (e.t === 'end') return { kind: 'system', text: e.winner === 'player' ? 'VICTORY' : e.winner === 'enemy' ? 'DEFEAT' : 'DRAW' };
  if (e.t === 'shot' && !e.seen) return e.shot === 1 ? { kind: 'fog', text: 'Gunfire echoes from the fog.' } : null;
  if (!e.seen) return null;
  switch (e.t) {
    case 'move': return { kind: kind(e.unit), text: `${who(e.unit)} moves (${e.from.x},${e.from.y}) -> (${e.to.x},${e.to.y})` };
    case 'shot': {
      if (e.finishing) return { kind: kind(e.attacker), text: `${who(e.attacker)} finishes off ${who(e.target)}` };
      const burst = e.shots > 1 ? ` [${e.shot}/${e.shots}]` : '';
      const result = e.hit ? `HIT for ${e.damage}` : 'MISS';
      return { kind: kind(e.attacker), text: `${e.overwatch ? '[OVERWATCH] ' : ''}${who(e.attacker)} shoots ${who(e.target)}${burst}: ${result} (${e.chance}%)` };
    }
    case 'damage': return { kind: kind(e.target), text: `${who(e.target)} takes ${e.amount} from the blast` };
    case 'downed': return { kind: 'system', text: `${who(e.unit)} goes down!` };
    case 'died': return { kind: 'system', text: `${who(e.unit)} is dead.` };
    case 'revive': return { kind: kind(e.unit), text: `${who(e.unit)} revives ${who(e.target)} (+${e.amount} HP)` };
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
    case 'door': return { kind: kind(e.unit), text: `${who(e.unit)} ${e.open ? 'opens' : 'closes'} the door at (${e.at.x},${e.at.y})` };
    case 'switch': return { kind: kind(e.unit), text: `${who(e.unit)} throws the switch at (${e.at.x},${e.at.y})${e.linked.length ? ` (${e.linked.length} door${e.linked.length > 1 ? 's' : ''} toggled)` : ''}` };
    case 'pickup': {
      const specific = e.item === 'armor' && e.itemId ? ARMOR[e.itemId as keyof typeof ARMOR].name
        : e.item === 'equipment' && e.itemId ? EQUIPMENT[e.itemId as keyof typeof EQUIPMENT].name : null;
      const label = specific ?? ITEMS[e.item].name;
      return { kind: kind(e.unit), text: `${who(e.unit)} picks up ${label}${!specific && e.amount > 1 ? ` (+${e.amount})` : ''}` };
    }
    case 'chest': return { kind: kind(e.unit), text: `${who(e.unit)} opens a chest at (${e.at.x},${e.at.y})` };
  }
}
