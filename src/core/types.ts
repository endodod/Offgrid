import type { ClassId } from '../data/units';
import type { GadgetId } from '../data/gadgets';
import type { AiProfileId } from '../data/aiProfiles';
import type { InteractableType, MapDef } from '../data/trainingGrounds';
import type { ObjectiveCapture } from '../data/rules';
import type { ObjectiveDef } from '../data/objectives';
import type { ItemType } from '../data/items';
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
  reserve: number; // ammo (4): rounds a reload can still draw from, beyond what's in the magazine
  medkits: number;
  actions: number;
  alive: boolean; // false only once truly (permanently) dead - a downed unit is still alive
  downed: boolean; // hp hit 0: can't act, still occupies its tile, dies for good when bleedOut runs out or takes another hit
  bleedOut: number; // rounds left before a downed unit dies for good; meaningless while not downed
  overwatch: boolean;
  exposed: boolean; // acted from a bush: visible there until its own team's next phase
  moveBonus: number; // extra tiles for this unit's next move (adrenaline); used up by that move, gone at end of turn
  gadget: { id: GadgetId; uses: number; cooldown: number } | null;
  aiProfile?: AiProfileId; // overrides GameState.aiProfiles[team] for this one unit; set from its spawn (see Spawn)
  // stats for the simulator
  dmgDealt: number;
  dmgTaken: number;
  kills: number;
  revives: number;
  reserveUsed: number; // ammo (4): total rounds drawn from reserve by reloads, for the sim's balance table
  ranDry: boolean; // ammo (4): true once this unit has ever had both ammo and reserve at 0 simultaneously
}

/** Last-seen marker. `hidden` becomes true once its tile has been out of sight, so a fresh look can clear it. */
export type Ghost = Pos & { hidden: boolean };

/** Objective hold in progress: the unit that interacted must stay on `at` until `roundsLeft` reaches 0. */
export interface Capture { team: Team; unit: number; at: Pos; roundsLeft: number }

export interface Scan { team: Team; x: number; y: number; radius: number; turnsLeft: number }

/**
 * A door or switch (2). `active` means: door -> open (passable, no LOS block); switch -> already thrown
 * (cosmetic only - what actually happens is toggling every door in `links`). Doors and switches share one
 * shape since both are just "a tile with a binary state a unit can flip by interacting with it."
 */
export interface Interactable {
  id: number;
  type: InteractableType;
  x: number;
  y: number;
  active: boolean;
  links?: number[]; // switch only: ids of doors it toggles when interacted with
}

/**
 * An ammo/medkit/gadget pickup on the map (4). No fog memory of its own - unlike a door's state, a pickup is
 * only ever "there" or "gone" (removed from `GameState.pickups` the instant anyone collects it), so it's drawn
 * purely from current visibility rather than remembered state (see render/renderer.ts's `drawPickups`).
 */
export interface Pickup {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  amount: number;
}

/** What a team remembers. Never contains information the team has not seen. */
export interface Memory {
  lastSeen: Record<number, Ghost>; // enemy unit id -> last seen position (the "ghost")
  objectiveSeen: boolean;
  searchIndex: number;
  doors: Record<number, boolean>; // interactable id -> last-seen `active` state (2)
}

/** `seen` = whether the player team could see it when it happened (used to filter the log). */
export type EventBody =
  | { t: 'phase'; team: Team; turn: number }
  | { t: 'move'; unit: number; from: Pos; to: Pos }
  | { t: 'shot'; attacker: number; target: number; shot: number; shots: number; chance: number; roll: number;
      hit: boolean; damage: number; overwatch: boolean; finishing: boolean; at: Pos; from: Pos }
  | { t: 'damage'; target: number; amount: number; source: 'grenade'; at: Pos }
  | { t: 'downed'; unit: number; at: Pos }
  | { t: 'died'; unit: number; at: Pos }
  | { t: 'revive'; unit: number; target: number; amount: number; at: Pos }
  | { t: 'reload'; unit: number }
  | { t: 'overwatch'; unit: number }
  | { t: 'exposed'; unit: number }
  | { t: 'heal'; unit: number; target: number; amount: number; at: Pos }
  | { t: 'gadget'; unit: number; gadget: GadgetId; target?: Pos }
  | { t: 'cover'; at: Pos; from: Cover | null; to: Cover | null }
  | { t: 'door'; unit: number; id: number; at: Pos; open: boolean }
  | { t: 'switch'; unit: number; id: number; at: Pos; on: boolean; linked: number[] }
  | { t: 'pickup'; unit: number; item: ItemType; amount: number; at: Pos }
  | { t: 'objective'; unit: number }
  | { t: 'capture'; unit: number; status: 'start' | 'progress' | 'broken'; roundsLeft: number }
  | { t: 'end'; winner: Team | 'draw' };
export type GameEvent = EventBody & { seen: boolean };

export interface GameOptions {
  objectiveCapture: ObjectiveCapture; timeOfDay?: TimeOfDayId; weather?: WeatherId;
  aiRevive?: boolean; // default true: whether the AI will path to and revive its own downed allies
  enemyProfile?: AiProfileId; // default 'standard' (or the map's own default)
  playerProfile?: AiProfileId; // only matters when the player team is AI-driven (the simulator, or 0d's auto-run)
  reserveMult?: number; // ammo (4): scales every unit's starting reserve; default 1 (or the map's own default)
}

export interface GameState {
  map: MapDef;
  width: number;
  height: number;
  terrain: Terrain[]; // index = y * width + x
  cover: (Cover | null)[];
  coverRot: number[]; // 0..3 quarter turns; purely visual
  capture: Capture | null;
  objective: Pos | null; // first 'O' tile, if any - the hold-type terminal's own position
  objectiveZone: Pos[]; // every 'O' tile (3); for 'hold' this is just [objective], 'reach' can have several
  objectiveDef: ObjectiveDef | null; // this mission's primary objective (3), resolved from MapDef.objective
  interactables: Interactable[]; // doors and switches (2); runtime copies, mutated in place
  pickups: Pickup[]; // ammo/medkit/gadget pickups (4); removed from the list once collected
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
  aiProfiles: Record<Team, AiProfileId>;
  options: GameOptions;
  visible: Record<Team, Uint8Array>;
  seenUnits: Record<Team, Set<number>>; // enemy units each team currently sees
  memory: Record<Team, Memory>;
  events: GameEvent[];
}

export const otherTeam = (t: Team): Team => (t === 'player' ? 'enemy' : 'player');
