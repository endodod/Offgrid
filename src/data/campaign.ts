import type { AiProfileId } from './aiProfiles';
import type { TimeOfDayId } from './timeOfDay';
import type { WeatherId } from './weather';
import { FUEL_DEPOT, JACKALS_DEN, LIGHTS_OUT, MARKET_ROW, PHARMACY_ROW, RAIL_YARD, SIGNAL_FIRE, UNDERPASS, WATERWORKS } from './maps';
import type { MapDef } from './trainingGrounds';

/** A node on the campaign map (5) - one district of Ashport. See STORY.md for the full premise. */
export interface District {
  id: string;
  name: string;
  act: 1 | 2 | 3;
  antagonist: string;
  blurb: string;
}

/**
 * Linear district order (5's own open question - "is the story sequence linear or branching?" - resolved as
 * linear for v1; see ROADMAP.md's Resolved section). Only Act 1's two districts have missions yet (below);
 * Acts 2-3 are named here so #5's progression/unlock mechanism has real targets to advance toward, per the
 * story section's own note that only the pool/sequencing mechanism is needed before those are written.
 */
export const DISTRICTS: District[] = [
  { id: 'riverside', name: 'Riverside', act: 1, antagonist: 'the Jackals', blurb: 'Home. A dead substation, a handful of survivors.' },
  { id: 'market-row', name: 'Market Row', act: 1, antagonist: 'the Jackals', blurb: 'Scavenged storefronts under loose Jackal patrol.' },
  { id: 'dockyards', name: 'Dockyards', act: 2, antagonist: 'the Cinder Wardens', blurb: 'Checkpoints and "tithes" on the waterfront.' },
  { id: 'substation-hill', name: 'Substation Hill', act: 2, antagonist: 'the Cinder Wardens', blurb: 'A fortified high point overlooking the grid.' },
  { id: 'old-town', name: 'Old Town', act: 2, antagonist: 'the Cinder Wardens', blurb: 'Narrow streets, heavier resistance.' },
  { id: 'uptown', name: 'Uptown', act: 3, antagonist: 'Halcyon Systems', blurb: 'What is left of corporate Ashport.' },
  { id: 'spire', name: 'The Spire', act: 3, antagonist: 'Halcyon Systems', blurb: 'Old Halcyon HQ - grid control, for whoever holds it.' },
];
export const DISTRICT_ORDER: string[] = DISTRICTS.map((d) => d.id);

/** One of the four fixed Act 1 story missions. Handcrafted end to end: each one owns a real `MapDef` under
 *  `data/maps/`, designed around its own objective type rather than sharing a layout. */
export interface StoryMissionDef {
  id: string;
  name: string;
  district: string; // a District.id
  /** Where the mission sits in the act - shown as "Mission 1 of 4" on the campaign screen. */
  act: 1 | 2 | 3;
  /** Two or three sentences of setup, spoken in the crew's voice. */
  blurb: string;
  objective: string;
  /** The beat the mission leaves behind, shown after it is completed. See STORY.md. */
  outcome: string;
  map: MapDef;
}

/** Act 1's four story missions, in play order. Later acts are unwritten (see DISTRICTS above). */
export const STORY_MISSIONS: StoryMissionDef[] = [
  {
    id: 'lights-out', name: 'Lights Out', district: 'riverside', act: 1,
    blurb: 'The substation two blocks from the safehouse still has a working feeder - the Jackals just got there first and fenced it. Get inside, throw both breakers, and Riverside has light for the first time in three years.',
    objective: 'Throw both breakers in the substation compound. Or eliminate every enemy.',
    outcome: 'The feeder holds. A man named Abel Cortez climbs out of the basement where he has been rationing a case of water for nine days, and asks who he has to shoot to stay.',
    map: LIGHTS_OUT,
  },
  {
    id: 'signal-fire', name: 'Signal Fire', district: 'riverside', act: 1,
    blurb: "Power means the relay on Kestrel Street can broadcast. Four rounds of carrier tone is enough for anyone still listening to find us - and enough for every Jackal in the district to find the roof.",
    objective: 'Start the relay and hold the roof for 4 rounds. Or eliminate every enemy.',
    outcome: 'The tone goes out. Nothing answers that night - but something answers three days later, in code, from the Dockyards, and it is not friendly.',
    map: SIGNAL_FIRE,
  },
  {
    id: 'supply-run-market-row', name: 'Supply Run: Market Row', district: 'market-row', act: 1,
    blurb: 'Abel says the covered market still has sealed crates under the collapsed awnings. Low stakes, high value: get in, get what you can carry, and be at the loading bay before the Jackals work out you are there.',
    objective: 'Get 3 units to the loading bay in the east. Or eliminate every enemy.',
    outcome: "Enough ammunition and gauze to matter, and a name scratched into every crate lid: VEX. The Jackals are not scavengers picking over Market Row. Somebody is running it.",
    map: MARKET_ROW,
  },
  {
    id: 'jackals-den', name: "The Jackals' Den", district: 'market-row', act: 1,
    blurb: 'Vex works out of the freight warehouse on the east end, behind a dock wall and four rows of shelving. Take the district by taking him - everything else the Jackals have is held together by the fact that nobody has.',
    objective: 'Eliminate Vex, the Jackal leader. Or eliminate every enemy.',
    outcome: 'Vex goes down in his own office. The Jackals scatter within the week - and in his desk is a fuel-tithe ledger, stamped with a cinder-and-wrench mark nobody in Riverside recognises.',
    map: JACKALS_DEN,
  },
];

/**
 * A generated "supply run" (5). Unlike a story mission it stores no `MapDef`: it names a template and the
 * conditions rolled on top of it, and `core/campaign.ts`'s `resolveSupplyRun` rebuilds the playable map at
 * launch. That keeps a saved campaign small (and, more importantly, keeps a save from pinning an old copy of
 * a map that has since been edited).
 */
export interface GeneratedMissionDef {
  id: string;
  templateId: string;
  complicationId: string;
  name: string;
  blurb: string;
  objective: string;
  enemyProfile: AiProfileId;
  tier: number;
  reward: number;
}

/** One of the hand-authored layouts a supply run can be rolled on. */
export interface SupplyRunTemplate {
  id: string;
  /** The location, used as the mission's subtitle: "Salvage Run: Ardent Fuel Depot". */
  name: string;
  blurb: string;
  objective: string;
  /** Short shape tags for the mission card, e.g. 'extraction', 'open ground'. */
  tags: string[];
  map: MapDef;
}

export const SUPPLY_RUN_TEMPLATES: SupplyRunTemplate[] = [
  {
    id: 'fuel-depot', name: 'Ardent Fuel Depot',
    blurb: 'Tank farm on the north bank. Diesel in the day tanks, and almost nothing between them and you.',
    objective: 'Get 3 units to the extraction corner. Or eliminate every enemy.',
    tags: ['extraction', 'open ground', 'long sightlines'],
    map: FUEL_DEPOT,
  },
  {
    id: 'pharmacy-row', name: 'Pharmacy Row',
    blurb: 'Six gutted shopfronts around one intact dispensary terminal. Whatever is still in the safe is on that console.',
    objective: 'Interact with the dispensary terminal and hold it. Or eliminate every enemy.',
    tags: ['hold', 'urban', 'close quarters'],
    map: PHARMACY_ROW,
  },
  {
    id: 'rail-yard', name: 'Halstead Rail Yard',
    blurb: 'A freight string the Jackals are stripping car by car. Cut both couplings and the rest of it is ours to come back for.',
    objective: 'Throw both coupling releases. Or eliminate every enemy.',
    tags: ['sabotage', 'lanes', 'no flanks'],
    map: RAIL_YARD,
  },
  {
    id: 'underpass', name: 'Vance Street Underpass',
    blurb: 'Two sealed service levels joined by two gaps you could plug with a chair. The cache is on the lower level.',
    objective: 'Get 3 units to the lower-level cache. Or eliminate every enemy.',
    tags: ['extraction', 'chokepoints', 'indoors'],
    map: UNDERPASS,
  },
  {
    id: 'waterworks', name: 'Cold Creek Waterworks',
    blurb: 'The Jackals run their quartermaster out of a settling tank here. Kill the ledger and the district goes hungry.',
    objective: 'Eliminate the Jackal quartermaster. Or eliminate every enemy.',
    tags: ['target', 'bunkers', 'one way in'],
    map: WATERWORKS,
  },
];

/**
 * A condition rolled on top of a template, so the same layout is not the same mission twice. Each one is a
 * plain `MapDef` override plus a reward multiplier - harder window, better pay.
 */
export interface SupplyRunComplication {
  id: string;
  label: string;
  blurb: string;
  rewardMult: number;
  timeOfDay?: TimeOfDayId;
  weather?: WeatherId;
  /** Scales both squads' starting reserve ammo, so "running dry" is symmetric scarcity, not a handicap. */
  reserveMult?: number;
}

export const SUPPLY_RUN_COMPLICATIONS: SupplyRunComplication[] = [
  { id: 'clear-window', label: 'Clear window', blurb: 'Good light, no weather. Nothing working against you but the people there.', rewardMult: 1 },
  { id: 'night-drop', label: 'Night drop', blurb: 'Moving in the dark: vision roughly halved and a heavy accuracy hit for both sides.', rewardMult: 1.3, timeOfDay: 'midnight' },
  { id: 'downpour', label: 'Downpour', blurb: 'Rain on wet ground - slower movement, blurred sight and aim.', rewardMult: 1.2, weather: 'rain' },
  { id: 'fog-bank', label: 'Fog bank', blurb: 'River fog off the channel: you will be on top of them before you see them.', rewardMult: 1.2, weather: 'fog' },
  { id: 'storm-front', label: 'Storm front', blurb: 'Wind and rain in the late afternoon. Everyone shoots badly and moves worse.', rewardMult: 1.45, timeOfDay: 'afternoon', weather: 'stormy' },
  { id: 'running-dry', label: 'Running dry', blurb: 'Both sides went in light: half the usual reserve ammo on the belt.', rewardMult: 1.35, reserveMult: 0.5 },
];

/** The job word in front of the location, e.g. "Quiet Extraction: Pharmacy Row". Flavour only. */
export const SUPPLY_RUN_CALLSIGNS = ['Salvage Run', 'Quiet Extraction', 'Night Patrol', 'Blockade Run', 'Perimeter Sweep', 'Last Convoy', 'Scrap Detail', 'Short Notice'];

/** Enemy-profile pools by difficulty tier (0 = easiest); `core/campaign.ts` picks a tier from completion count. */
export const SUPPLY_RUN_PROFILE_TIERS: AiProfileId[][] = [
  ['easy', 'easy', 'standard'],
  ['standard', 'standard', 'camper'],
  ['standard', 'hard', 'camper'],
  ['hard', 'hard', 'ambush'],
];

/** What each tier is called on the mission card. */
export const SUPPLY_RUN_TIER_LABELS = ['Light resistance', 'Contested', 'Dug in', 'Hostile territory'];

export const supplyRunTemplate = (id: string): SupplyRunTemplate | undefined => SUPPLY_RUN_TEMPLATES.find((t) => t.id === id);
export const supplyRunComplication = (id: string): SupplyRunComplication | undefined => SUPPLY_RUN_COMPLICATIONS.find((c) => c.id === id);
