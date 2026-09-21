/** Pickups on the map (4): a unit collects one for free by walking onto its tile. */
export type ItemType = 'ammo' | 'medkit' | 'gadget';
export const ITEM_ORDER: ItemType[] = ['ammo', 'medkit', 'gadget'];

export interface ItemDef {
  name: string;
  blurb: string;
  defaultAmount: number; // used when a map's PickupDef omits `amount`
}

export const ITEMS: Record<ItemType, ItemDef> = {
  ammo: { name: 'Ammo crate', blurb: 'Refills reserve ammo - reload draws from it.', defaultAmount: 6 },
  medkit: { name: 'Medkit', blurb: 'A spare medkit, usable for first aid or revive.', defaultAmount: 1 },
  gadget: { name: 'Gadget charge', blurb: "Restores a use of whichever gadget the unit who picks it up carries.", defaultAmount: 1 },
};
