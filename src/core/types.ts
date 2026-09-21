import type { ClassId } from '../data/units';
import type { GadgetId } from '../data/gadgets';
import type { MapDef } from '../data/trainingGrounds';
import type { ObjectiveCapture } from '../data/rules';
import type { TimeOfDayId } from '../data/timeOfDay';
import type { WeatherId } from '../data/weather';

export type Team = 'player' | 'enemy';
export type Terrain = 'floor' | 'wall' | 'bush';
export type Cover = 'low' | 'high';
export type CoverState = 'none' | 'low' | 'high' | 'flanked';
export interface Pos { x: number; y: number }

export interface Unit {
  id: number;
  team: Team;
  cls: ClassId;
  x: number;
  y: number;
  hp: number;
  ammo: number;
  medkits: number;
  actions: number;
  alive: boolean;
  overwatch: boolean;
  exposed: boolean; // acted from a bush: visible there until its own team's next phase
  moveBonus: number; // extra tiles for this unit's next move (adrenaline); used up by that move, gone at end of turn
  gadget: { id: GadgetId; uses: number; cooldown: number } | null;
  // stats for the simulator
  dmgDealt: number;
  dmgTaken: number;
  kills: number;
}

/** Last-seen marker. `hidden` becomes true once its tile has been out of sight, so a fresh look can clear it. */
export type Ghost = Pos & { hidden: boolean };

/** Objective hold in progress: the unit that interacted must stay on `at` until `roundsLeft` reaches 0. */
export interface Capture { team: Team; unit: number; at: Pos; roundsLeft: number }

export interface Scan { team: Team; x: number; y: number; radius: number; turnsLeft: number }

/** What a team remembers. Never contains information the team has not seen. */
export interface Memory {
  lastSeen: Record<number, Ghost>; // enemy unit id -> last seen position (the "ghost")
  objectiveSeen: boolean;
  searchIndex: number;
}

/** `seen` = whether the player team could see it when it happened (used to filter the log). */
export type EventBody =
  | { t: 'phase'; team: Team; turn: number }
  | { t: 'move'; unit: number; from: Pos; to: Pos }
  | { t: 'shot'; attacker: number; target: number; shot: number; shots: number; chance: number; roll: number;
      hit: boolean; damage: number; overwatch: boolean; at: Pos; from: Pos }
  | { t: 'damage'; target: number; amount: number; source: 'grenade'; at: Pos }
  | { t: 'died'; unit: number; at: Pos }
  | { t: 'reload'; unit: number }
  | { t: 'overwatch'; unit: number }
  | { t: 'exposed'; unit: number }
  | { t: 'heal'; unit: number; target: number; amount: number; at: Pos }
  | { t: 'gadget'; unit: number; gadget: GadgetId; target?: Pos }
  | { t: 'cover'; at: Pos; from: Cover | null; to: Cover | null }
  | { t: 'objective'; unit: number }
  | { t: 'capture'; unit: number; status: 'start' | 'progress' | 'broken'; roundsLeft: number }
  | { t: 'end'; winner: Team | 'draw' };
export type GameEvent = EventBody & { seen: boolean };

export interface GameOptions { objectiveCapture: ObjectiveCapture; timeOfDay?: TimeOfDayId; weather?: WeatherId }

export interface GameState {
  map: MapDef;
  width: number;
  height: number;
  terrain: Terrain[]; // index = y * width + x
  cover: (Cover | null)[];
  coverRot: number[]; // 0..3 quarter turns; purely visual
  capture: Capture | null;
  objective: Pos | null;
  units: Unit[];
  phase: Team;
  turn: number;
  scans: Scan[];
  seed: number;
  rng: number;
  /** Test hook: replaces the RNG for rolls when set. */
  rollSource?: () => number;
  winner: Team | 'draw' | null;
  fogEnabled: boolean; // debug: only affects the player team's view
  timeOfDay: TimeOfDayId;
  weather: WeatherId;
  options: GameOptions;
  visible: Record<Team, Uint8Array>;
  seenUnits: Record<Team, Set<number>>; // enemy units each team currently sees
  memory: Record<Team, Memory>;
  events: GameEvent[];
}

export const otherTeam = (t: Team): Team => (t === 'player' ? 'enemy' : 'player');
