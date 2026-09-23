/** Armor pieces (7): fill a unit's single armor slot. The bonus stacks on top of the class's own base armor -
 *  see core/combat.ts's `effectiveArmor` (resolves the design sketch's "stack or replace" open question). */
export type ArmorId = 'lightVest' | 'ceramicPlate' | 'heavyPlate';
export const ARMOR_ORDER: ArmorId[] = ['lightVest', 'ceramicPlate', 'heavyPlate'];

export interface ArmorDef {
  name: string;
  blurb: string;
  armorBonus: number;
}

export const ARMOR: Record<ArmorId, ArmorDef> = {
  lightVest: { name: 'Light Vest', blurb: '+1 armor.', armorBonus: 1 },
  ceramicPlate: { name: 'Ceramic Plate', blurb: '+2 armor. Only made in the fabricator.', armorBonus: 2 },
  heavyPlate: { name: 'Heavy Plate', blurb: '+3 armor - a real dent in a shot\'s damage.', armorBonus: 3 },
};
