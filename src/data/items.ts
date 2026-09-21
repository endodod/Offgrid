/** Pickups on the map (4): a unit collects one for free by walking onto its tile. 'armor'/'equipment' (7) are
 *  loot - see data/loot.ts, data/armor.ts, data/equipment.ts - and carry a specific `itemId` on the Pickup
 *  itself rather than a generic `amount` (there's exactly one of a specific piece, not a stack of a category). */
export type ItemType = 'ammo' | 'medkit' | 'gadget' | 'armor' | 'equipment';
export const ITEM_ORDER: ItemType[] = ['ammo', 'medkit', 'gadget', 'armor', 'equipment'];

export interface ItemDef {
  name: string;
  blurb: string;
  defaultAmount: number; // used when a map's PickupDef omits `amount`; meaningless for armor/equipment (always 1)
}

export const ITEMS: Record<ItemType, ItemDef> = {
  ammo: { name: 'Ammo crate', blurb: 'Refills reserve ammo - reload draws from it.', defaultAmount: 6 },
  medkit: { name: 'Medkit', blurb: 'A spare medkit, usable for first aid or revive.', defaultAmount: 1 },
  gadget: { name: 'Gadget charge', blurb: "Restores a use of whichever gadget the unit who picks it up carries.", defaultAmount: 1 },
  armor: { name: 'Armor', blurb: 'Equips the specific piece into the collecting unit\'s armor slot.', defaultAmount: 1 },
  equipment: { name: 'Equipment', blurb: "Equips the specific piece into the collecting unit's first open equipment slot.", defaultAmount: 1 },
};
