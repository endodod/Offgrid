import type { ClassId } from './units';
import type { AiProfileId } from './aiProfiles';
import type { TimeOfDayId } from './timeOfDay';
import type { WeatherId } from './weather';
import type { ObjectiveDef } from './objectives';
import type { ItemType } from './items';
import type { ArmorId } from './armor';
import type { EquipmentId } from './equipment';
import type { PerkId } from './perks';

/** [class, x, y, aiProfile?]. A team can field several units of one class. aiProfile overrides the team/mission
 *  default (MapDef.enemyProfile / GameOptions) for this one unit - most useful to mix habitats in one squad
 *  (e.g. one camper covering a doorway while the rest patrol). */
export type Spawn = [ClassId, number, number, AiProfileId?];

/** A door, switch or chest (2, 7). See core/types.ts's Interactable for the runtime (mutable) shape this seeds. */
export type InteractableType = 'door' | 'switch' | 'chest';
export interface InteractableDef {
  id: number;
  type: InteractableType;
  x: number;
  y: number;
  active?: boolean; // defaults to false (door closed / switch not yet thrown / chest not yet opened)
  links?: number[]; // switch only: ids of doors it toggles when interacted with
}

/** A pickup on the map (4). A unit collects it for free by walking onto its tile - see core/actions.ts's
 *  `collectPickup`. See core/types.ts's Pickup for the runtime (removed-once-collected) shape this seeds. */
export interface PickupDef {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  amount?: number; // defaults to ITEMS[type].defaultAmount; unused for 'armor'/'equipment' (see itemId)
  itemId?: ArmorId | EquipmentId; // required when type is 'armor' or 'equipment' (7) - which specific piece
}

/** A unit's armor/equipment loadout (7): both an in-mission `Unit`'s live fields and what a campaign mission
 *  (5) starts a unit with - see `MapDef.squad` below and core/campaign.ts's `Soldier`. */
/** One deploying campaign soldier (13): see `MapDef.squad`. */
export interface SquadMember {
  soldierId: string;
  name: string;
  cls: ClassId;
  loadout: UnitLoadout;
  progress: ClassProgress;
  hp?: number; // missing = full
}

export interface UnitLoadout {
  armor: ArmorId | null;
  equipment: [EquipmentId | null, EquipmentId | null];
}

/** A class's leveling progress (8): both an in-mission `Unit`'s live fields and what a campaign mission (5)
 *  starts a soldier at - see `MapDef.squad` below and core/campaign.ts's `Soldier`. */
export interface ClassProgress {
  xp: number;
  level: number;
  perkPool: PerkId[]; // unlocked so far - permanent, never lost (see core/leveling.ts's resetOnDeath)
  equippedPerks: PerkId[]; // currently active, length capped by the current level's slot count
}

export interface MapDef {
  name: string;
  /**
   * '.' floor  '#' wall  'b' bush  'h' high cover  'O' objective
   * 'l' low cover, and '1' '2' '3' = low cover rotated 90 / 180 / 270 degrees (visual only)
   * Doors and switches are not tile characters - the grid stays plain floor under them (2); see `interactables`.
   */
  rows: string[];
  spawns: Record<'player' | 'enemy', Spawn[]>;
  /** Waypoints the AI explores when it has no target and has not seen the objective. */
  searchPoints: Record<'player' | 'enemy', [number, number][]>;
  /** Starting conditions for this map; undefined falls back to createGame's default (midday, clear). */
  startTimeOfDay?: TimeOfDayId;
  startWeather?: WeatherId;
  /** The enemy squad's AI habitat/difficulty; undefined falls back to createGame's default ('standard'). */
  enemyProfile?: AiProfileId;
  /** Doors and switches (2); undefined/omitted is the same as an empty list. */
  interactables?: InteractableDef[];
  /** Ammo/medkit/gadget pickups (4); undefined/omitted is the same as an empty list. */
  pickups?: PickupDef[];
  /** Scales every unit's starting reserve ammo (4), e.g. 0.5 for a scarcer mission; undefined falls back to
   *  createGame's default (1 - each class's own `reserve` from data/units.ts, unscaled). */
  reserveMult?: number;
  /** Base-building bonuses (6): usually set programmatically at mission-launch time from a built base's
   *  facilities (see ui/campaign.ts's `applyBase`) rather than hand-authored, but they're plain MapDef fields -
   *  like `reserveMult` above - so applying them needs no changes to Session's own API. Unlike `reserveMult`
   *  (symmetric, both teams), `playerReserveMult` only ever affects the player's own squad. */
  playerReserveMult?: number;
  medkitBonus?: number;
  gadgetUsesBonus?: number;
  /** The campaign squad (13), same "system-set MapDef field" trick as the base-building fields above - see
   *  core/roster.ts's `deploySquad`. When set, the i-th member takes the i-th player spawn tile, whatever class
   *  that spawn was authored as, and brings their own class, gear, progress and HP. Missing = the map's own
   *  spawns, bare. */
  squad?: SquadMember[];
  /** The mission's primary objective (3); undefined = the legacy default (hold the single 'O' tile if the map
   *  has one, else no primary objective - just the always-on team-wipeout win/loss). */
  objective?: ObjectiveDef;
}

// Laid out in the debug map builder (see README) and pasted back from its JSON export.
// Friendly squad starts clustered bottom-left; the objective terminal is central at (12,7), open on two sides
// rather than behind a single doorway. One enemy (a sniper - the weakest class) starts close by and already
// mutually visible at turn 1, so every guided-tutorial step (0f) is reachable within the first turn or two
// without a long, fog-blind search; the other four enemies stay spread out on the right for the rest of the
// mission once the tutorial's done. See ROADMAP.md's #0c "sim finding" for what this replaced.
export const TRAINING_GROUNDS: MapDef = {
  name: 'Training Grounds',
  rows: [
    '.....#.b########........',
    '.....#.bbbb....h........',
    '.....#..................',
    '.............1...3......',
    '..........2.h..#.3......',
    '........##....##........',
    '..lh.hl....3...b###b.h.#',
    '.......h...hO..bbbbb.1..',
    '...bb..1..............h.',
    '.........#.....#####....',
    '.ll..hh....3.......#.22.',
    '............h.....b#....',
    '.........#.....#.bb#....',
    '.........##..#######...h',
    '..................h.....',
    '..........l....h........',
  ],
  spawns: {
    player: [['soldier', 2, 11], ['assault', 3, 11], ['medic', 2, 12], ['tank', 1, 13], ['sniper', 3, 13]],
    enemy: [['sniper', 9, 10], ['medic', 22, 14], ['assault', 20, 3], ['assault', 18, 2], ['medic', 22, 1]],
  },
  searchPoints: {
    player: [[11, 3], [3, 5], [17, 11]],
    enemy: [[11, 3], [17, 11], [3, 5]],
  },
};
