import type { GadgetId } from './gadgets';

export type ClassId = 'sniper' | 'assault' | 'soldier' | 'medic' | 'tank' | 'sentry' | 'drone';
/** The five classes a soldier can be - the roster, recruits, the builder's player palette. */
export const CLASS_ORDER: ClassId[] = ['sniper', 'assault', 'soldier', 'medic', 'tank'];
/** Act 3: Halcyon hardware. Enemy-only - never on the roster, never levels, never carries gear. */
export const ENEMY_ONLY_CLASSES: ClassId[] = ['sentry', 'drone'];
/** Every class, playable first - for anything that lists all of them (the builder, the sim's table). */
export const ALL_CLASSES: ClassId[] = [...CLASS_ORDER, ...ENEMY_ONLY_CLASSES];

export interface WeaponDef {
  range: number;
  damage: number;
  shots: number; // shots per attack action (1 ammo per attack regardless)
  accuracy: number; // percent
  magazine: number;
}

export interface ClassDef {
  name: string;
  letter: string;
  hp: number;
  armor: number;
  move: number;
  vision: number;
  weapon: WeaponDef;
  reserve: number; // ammo (4): total reload-able rounds beyond the starting magazine, see RULES/ammo economy
  gadget: GadgetId; // only handed to player-team units
}

export const CLASSES: Record<ClassId, ClassDef> = {
  sniper:  { name: 'Sniper',  letter: 'S', hp: 8,  armor: 0, move: 5, vision: 8, reserve: 6, gadget: 'scan',
             weapon: { range: 12, damage: 7, shots: 1, accuracy: 85, magazine: 3 } },
  assault: { name: 'Assault', letter: 'A', hp: 12, armor: 0, move: 6, vision: 6, reserve: 12, gadget: 'adrenaline',
             weapon: { range: 4,  damage: 2, shots: 3, accuracy: 60, magazine: 4 } },
  soldier: { name: 'Soldier', letter: 'R', hp: 12, armor: 1, move: 5, vision: 7, reserve: 18, gadget: 'grenade',
             weapon: { range: 7,  damage: 4, shots: 1, accuracy: 70, magazine: 6 } },
  // A soldier who trades the grenade for a full-heal medkit, and is frailer (less HP, no armor).
  medic:   { name: 'Medic',   letter: 'M', hp: 9,  armor: 0, move: 5, vision: 7, reserve: 18, gadget: 'medkit',
             weapon: { range: 7,  damage: 4, shots: 1, accuracy: 70, magazine: 6 } },
  tank:    { name: 'Tank',    letter: 'T', hp: 24, armor: 3, move: 4, vision: 5, reserve: 12, gadget: 'cover',
             weapon: { range: 6,  damage: 3, shots: 1, accuracy: 70, magazine: 6 } },
  // Act 3 (Halcyon Systems). A bolted-down gun on a tripod: never moves, sees far, hits hard, armored. The
  // counterplay is walls - it can't come looking - and flanking, since it has no cover of its own unless placed in it.
  sentry:  { name: 'Sentry',  letter: 'X', hp: 14, armor: 2, move: 0, vision: 9, reserve: 30, gadget: 'scan',
             weapon: { range: 9,  damage: 4, shots: 1, accuracy: 70, magazine: 10 } },
  // A quad-rotor with a carbine slung under it: fast, far-sighted, fragile. Spots for everything else.
  drone:   { name: 'Drone',   letter: 'D', hp: 7,  armor: 0, move: 7, vision: 9, reserve: 12, gadget: 'scan',
             weapon: { range: 6,  damage: 2, shots: 2, accuracy: 65, magazine: 4 } },
};

export const isEnemyOnly = (cls: ClassId): boolean => ENEMY_ONLY_CLASSES.includes(cls);
