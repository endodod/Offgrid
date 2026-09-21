import type { InteractableDef, MapDef, Spawn } from '../data/trainingGrounds';
import type { AiProfileId } from '../data/aiProfiles';
import type { ClassId } from '../data/units';
import type { ObjectiveDef } from '../data/objectives';
import { perform, type Action } from './actions';
import { createGame } from './state';
import type { GameOptions, GameState, Team, Unit } from './types';
import { refreshVision } from './vision';

// the 3rd tuple element is an optional per-unit AI profile override, same as Spawn's own 4th element
type Spawns = Partial<Record<Team, Partial<Record<ClassId, [number, number, AiProfileId?]>>>>;

const toSpawns = (units: Spawns[Team] = {}): Spawn[] =>
  Object.entries(units).map(([cls, at]) => [cls as ClassId, at[0], at[1], at[2]]);

/** Blank floor map with (x, y, char) edits, e.g. blank(12, 5, [[4, 2, 'l']]). */
export function blank(w: number, h: number, edits: [number, number, string][] = []): string[] {
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [x, y, c] of edits) g[y][x] = c;
  return g.map((r) => r.join(''));
}

/** Small hand-made scenario. Both teams should have a unit or the game ends on the first action. */
export function makeGame(
  rows: string[], spawns: Spawns, options: Partial<GameOptions> = {}, interactables: InteractableDef[] = [], objective?: ObjectiveDef,
): GameState {
  const map: MapDef = {
    name: 'test', rows, searchPoints: { player: [], enemy: [] },
    spawns: { player: toSpawns(spawns.player), enemy: toSpawns(spawns.enemy) },
    interactables, objective,
  };
  return createGame(map, 1, options);
}

export const unit = (s: GameState, team: Team, cls: ClassId): Unit => {
  const u = s.units.find((x) => x.team === team && x.cls === cls);
  if (!u) throw new Error(`no ${team} ${cls}`);
  return u;
};

export function place(s: GameState, u: Unit, x: number, y: number) {
  u.x = x;
  u.y = y;
  refreshVision(s);
}

export function act(s: GameState, a: Action) {
  const r = perform(s, a);
  if (!r.ok) throw new Error(`action ${a.type} failed: ${r.error}`);
  return r.events;
}

/** Make every roll come from a fixed queue (values in [0,1)); the last value repeats. */
export function rolls(s: GameState, ...values: number[]) {
  let i = 0;
  s.rollSource = () => values[Math.min(i++, values.length - 1)];
}

export const endTurns = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) act(s, { type: 'endTurn' });
};
