import type { GadgetId } from './gadgets';

export type ClassId = 'sniper' | 'assault' | 'soldier' | 'medic' | 'tank';
export const CLASS_ORDER: ClassId[] = ['sniper', 'assault', 'soldier', 'medic', 'tank'];

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
  gadget: GadgetId; // only handed to player-team units
}

export const CLASSES: Record<ClassId, ClassDef> = {
  sniper:  { name: 'Sniper',  letter: 'S', hp: 8,  armor: 0, move: 5, vision: 8, gadget: 'scan',
             weapon: { range: 12, damage: 7, shots: 1, accuracy: 85, magazine: 3 } },
  assault: { name: 'Assault', letter: 'A', hp: 12, armor: 0, move: 6, vision: 6, gadget: 'adrenaline',
             weapon: { range: 4,  damage: 2, shots: 3, accuracy: 60, magazine: 4 } },
  soldier: { name: 'Soldier', letter: 'R', hp: 12, armor: 1, move: 5, vision: 7, gadget: 'grenade',
             weapon: { range: 7,  damage: 4, shots: 1, accuracy: 70, magazine: 6 } },
  // A soldier who trades the grenade for a full-heal medkit, and is frailer (less HP, no armor).
  medic:   { name: 'Medic',   letter: 'M', hp: 9,  armor: 0, move: 5, vision: 7, gadget: 'medkit',
             weapon: { range: 7,  damage: 4, shots: 1, accuracy: 70, magazine: 6 } },
  tank:    { name: 'Tank',    letter: 'T', hp: 24, armor: 3, move: 4, vision: 5, gadget: 'cover',
             weapon: { range: 6,  damage: 3, shots: 1, accuracy: 70, magazine: 6 } },
};
