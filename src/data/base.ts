/**
 * Home-base stations (6, overhauled in 11): buildable/upgradeable, funded by campaign salvage
 * (`CampaignState.currency`). Each tier's `effect` means something different per station - see the comment
 * on each entry. Mission-launch bonuses are applied in core/base.ts's `baseGameOptions`; the between-mission
 * effects (healing, training, crafting, intel, offers) live in core/roster.ts, core/crafting.ts and
 * core/campaign.ts.
 */
export type FacilityId =
  | 'infirmary' | 'barracks' | 'medstation'
  | 'workbench' | 'locker' | 'fabricator'
  | 'commsRelay' | 'reconUplink' | 'trainingRoom' | 'warRoom';

export const FACILITY_ORDER: FacilityId[] = [
  'infirmary', 'barracks', 'medstation',
  'workbench', 'locker', 'fabricator',
  'commsRelay', 'reconUplink', 'trainingRoom', 'warRoom',
];

export type FacilityGroup = 'Medical' | 'Supply' | 'Operations';

export interface FacilityTier {
  cost: number;
  effect: number;
  blurb: string;
}

export interface FacilityDef {
  id: FacilityId;
  name: string;
  group: FacilityGroup;
  blurb: string;
  tiers: FacilityTier[]; // tiers[0] is the cost/effect to build it at level 1, tiers[1] to reach level 2, etc.
}

/** Healing and rest (11). Fractions of a soldier's max HP recovered per mission the campaign plays. */
export const REST_BASE = 0.2; // sat the mission out, no barracks built
export const INFIRMARY_HEAL = [0.6, 0.8, 1]; // per infirmary level, for a soldier in a bed
/** A soldier who deployed and survived recovers this share of the rest rate (field dressing, not a bed). */
export const PATCH_SHARE = 0.5;
/** Locker capacity with no locker upgrades. */
export const LOCKER_BASE = 6;

export const FACILITIES: Record<FacilityId, FacilityDef> = {
  // effect = beds. How much a bed heals is INFIRMARY_HEAL[level - 1].
  infirmary: {
    id: 'infirmary', name: 'Infirmary', group: 'Medical',
    blurb: 'Beds for the wounded. A soldier in a bed sits missions out and heals fast.',
    tiers: [
      { cost: 120, effect: 1, blurb: '1 bed · 60% HP per mission' },
      { cost: 250, effect: 2, blurb: '2 beds · 80% HP per mission' },
      { cost: 400, effect: 3, blurb: '3 beds · full heal per mission' },
    ],
  },
  // effect = the share of max HP a benched soldier recovers per mission (REST_BASE unbuilt).
  barracks: {
    id: 'barracks', name: 'Barracks', group: 'Medical',
    blurb: 'Proper bunks. Everyone not in a bed recovers faster between missions.',
    tiers: [
      { cost: 100, effect: 0.3, blurb: 'Rest heals 30% (from 20%)' },
      { cost: 200, effect: 0.4, blurb: 'Rest heals 40%' },
      { cost: 350, effect: 0.5, blurb: 'Rest heals 50%' },
    ],
  },
  // effect = extra medkits per unit.
  medstation: {
    id: 'medstation', name: 'Medstation', group: 'Medical',
    blurb: 'A trauma kit stockroom: extra medkits packed before every mission.',
    tiers: [
      { cost: 150, effect: 1, blurb: '+1 medkit per unit' },
      { cost: 300, effect: 2, blurb: '+2 medkits per unit' },
      { cost: 500, effect: 3, blurb: '+3 medkits per unit' },
    ],
  },
  // effect = fraction added to the squad's starting reserve ammo.
  workbench: {
    id: 'workbench', name: 'Workbench', group: 'Supply',
    blurb: 'Hand-loaded rounds and better-organized crates: more reserve ammo to start with.',
    tiers: [
      { cost: 150, effect: 0.25, blurb: '+25% starting reserve ammo' },
      { cost: 300, effect: 0.5, blurb: '+50% starting reserve ammo' },
      { cost: 500, effect: 1, blurb: '+100% starting reserve ammo' },
    ],
  },
  // effect = locker capacity (LOCKER_BASE unbuilt).
  locker: {
    id: 'locker', name: 'Locker', group: 'Supply',
    blurb: 'Shelving for spare gear. Anything over capacity after a mission is scrapped for parts.',
    tiers: [
      { cost: 80, effect: 10, blurb: 'Holds 10 pieces (from 6)' },
      { cost: 160, effect: 16, blurb: 'Holds 16 pieces' },
      { cost: 300, effect: 24, blurb: 'Holds 24 pieces' },
    ],
  },
  // effect = the highest recipe tier that can be crafted (data/crafting.ts).
  fabricator: {
    id: 'fabricator', name: 'Fabricator', group: 'Supply',
    blurb: 'Turns salvaged parts into gear. Each level unlocks better recipes.',
    tiers: [
      { cost: 150, effect: 1, blurb: 'Basic gear: boots, flashlight, vest, med pouch' },
      { cost: 300, effect: 2, blurb: 'Adds NVG, bandolier, ceramic plate' },
      { cost: 450, effect: 3, blurb: 'Adds heavy plate' },
    ],
  },
  // effect = extra gadget uses per unit.
  commsRelay: {
    id: 'commsRelay', name: 'Comms Relay', group: 'Operations',
    blurb: 'Better coordination between units: extra gadget charges per mission.',
    tiers: [
      { cost: 150, effect: 1, blurb: '+1 gadget use' },
      { cost: 300, effect: 2, blurb: '+2 gadget uses' },
      { cost: 500, effect: 3, blurb: '+3 gadget uses' },
    ],
  },
  // effect = intel level on the briefing screen (see ui/briefing.ts).
  reconUplink: {
    id: 'reconUplink', name: 'Recon Uplink', group: 'Operations',
    blurb: 'Drone passes over the target before you commit. Shown on the mission briefing.',
    tiers: [
      { cost: 100, effect: 1, blurb: 'Map layout and conditions' },
      { cost: 220, effect: 2, blurb: 'Hostile positions and types' },
      { cost: 380, effect: 3, blurb: 'Supply caches and the objective' },
    ],
  },
  // effect = XP each soldier who sat a mission out gains.
  trainingRoom: {
    id: 'trainingRoom', name: 'Training Room', group: 'Operations',
    blurb: 'Drills for whoever stays home. Soldiers who sit a mission out still earn XP.',
    tiers: [
      { cost: 120, effect: 15, blurb: '+15 XP per mission benched' },
      { cost: 250, effect: 30, blurb: '+30 XP per mission benched' },
      { cost: 400, effect: 50, blurb: '+50 XP per mission benched' },
    ],
  },
  // effect = extra supply-run offers on the campaign screen.
  warRoom: {
    id: 'warRoom', name: 'War Room', group: 'Operations',
    blurb: 'Contacts across the city. More supply runs on offer at once.',
    tiers: [
      { cost: 150, effect: 1, blurb: '4 supply runs on offer' },
      { cost: 300, effect: 2, blurb: '5 supply runs on offer' },
      { cost: 500, effect: 3, blurb: '6 supply runs on offer' },
    ],
  },
};
