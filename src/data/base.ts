/**
 * Home-base facilities (6): buildable/upgradeable, funded by campaign currency (5's `CampaignState.currency`,
 * the "first thing that spends it" - see ROADMAP.md #5's Resolved). Each facility's tiers grant a
 * meta-progression bonus applied to every mission launched from the campaign screen - see core/base.ts's
 * `baseGameOptions` and ui/campaign.ts's `applyBase`.
 */
export type FacilityId = 'medstation' | 'workbench' | 'commsRelay';
export const FACILITY_ORDER: FacilityId[] = ['medstation', 'workbench', 'commsRelay'];

export interface FacilityTier {
  cost: number;
  /** Meaning depends on the facility: medstation = extra medkits per unit, workbench = extra starting
   *  reserve ammo (a fraction added to reserveMult), commsRelay = extra gadget uses per unit. */
  effect: number;
  blurb: string;
}

export interface FacilityDef {
  id: FacilityId;
  name: string;
  blurb: string;
  tiers: FacilityTier[]; // tiers[0] is the cost/effect to build it at level 1, tiers[1] to reach level 2, etc.
}

export const FACILITIES: Record<FacilityId, FacilityDef> = {
  medstation: {
    id: 'medstation', name: 'Medstation', blurb: 'A trauma bay for the squad - extra medkits stocked before every mission.',
    tiers: [
      { cost: 150, effect: 1, blurb: '+1 medkit per unit' },
      { cost: 300, effect: 2, blurb: '+2 medkits per unit' },
      { cost: 500, effect: 3, blurb: '+3 medkits per unit' },
    ],
  },
  workbench: {
    id: 'workbench', name: 'Workbench', blurb: 'Hand-loaded rounds and better-organized crates - more reserve ammo to start with.',
    tiers: [
      { cost: 150, effect: 0.25, blurb: '+25% starting reserve ammo' },
      { cost: 300, effect: 0.5, blurb: '+50% starting reserve ammo' },
      { cost: 500, effect: 1, blurb: '+100% starting reserve ammo' },
    ],
  },
  commsRelay: {
    id: 'commsRelay', name: 'Comms Relay', blurb: 'Better coordination between units - extra gadget charges per mission.',
    tiers: [
      { cost: 150, effect: 1, blurb: '+1 gadget use' },
      { cost: 300, effect: 2, blurb: '+2 gadget uses' },
      { cost: 500, effect: 3, blurb: '+3 gadget uses' },
    ],
  },
};
