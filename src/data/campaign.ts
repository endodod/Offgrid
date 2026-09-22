import type { AiProfileId } from './aiProfiles';
import type { TimeOfDayId } from './timeOfDay';
import type { WeatherId } from './weather';
import {
  COLD_STORAGE, FUEL_DEPOT, JACKALS_DEN, LIGHTS_OUT, MARKET_ROW, NIGHT_MARKET, PHARMACY_ROW, PUMPHOUSE,
  RAIL_YARD, ROW_RELAY, SIGNAL_FIRE, THE_CLINIC, TOLLGATE, UNDERPASS, WATERWORKS,
} from './maps';
import type { MapDef } from './trainingGrounds';

/** A node on the campaign map (5) - one district of Ashport. See STORY.md for the full premise. */
export interface District {
  id: string;
  name: string;
  act: 1 | 2 | 3;
  antagonist: string;
  blurb: string;
  /** Shown once, as a modal, the first time the district is unlocked. See ui/campaign.ts. */
  intro: { title: string; body: string[] };
}

/**
 * Linear district order (5's own open question - "is the story sequence linear or branching?" - resolved as
 * linear for v1; see ROADMAP.md's Resolved section). Only Act 1's two districts have missions yet (below);
 * Acts 2-3 are named here so #5's progression/unlock mechanism has real targets to advance toward, per the
 * story section's own note that only the pool/sequencing mechanism is needed before those are written.
 */
export const DISTRICTS: District[] = [
  {
    id: 'riverside', name: 'Riverside', act: 1, antagonist: 'the Jackals',
    blurb: 'Home. A dead substation, a handful of survivors.',
    intro: {
      title: 'Riverside',
      body: [
        'Three years since the grid went down. Three years of the same argument: wait for someone to come, or stop waiting.',
        'You have a dead substation, a basement that holds heat, and four people who are still here because leaving was worse. Two blocks east, the Jackals have the only working feeder in the district behind a chain-link fence, because that is what the Jackals do - find the one thing that still works and sit on it.',
        'Nobody is coming. So: lights first. Everything else is downstream of lights.',
      ],
    },
  },
  {
    id: 'market-row', name: 'Market Row', act: 1, antagonist: 'the Jackals',
    blurb: 'Scavenged storefronts under loose Jackal patrol.',
    intro: {
      title: 'Market Row',
      body: [
        'Riverside is lit. Word travels faster than it has any right to in a city with no radio, and what came back down the line was a name: Vex.',
        'Market Row was six blocks of covered market and it is now six blocks of Jackal storage. They are not scavenging it. They are inventorying it - crates stacked by contents, lids marked in the same hand, a rota for the patrols.',
        'Scavengers do not keep books. Somebody taught them to. Find out who, and take the Row.',
      ],
    },
  },
  {
    id: 'dockyards', name: 'Dockyards', act: 2, antagonist: 'the Cinder Wardens',
    blurb: 'Checkpoints and "tithes" on the waterfront.',
    intro: {
      title: 'The Dockyards',
      body: [
        'The coded transmission that answered your relay came from the waterfront, and it was not asking for help. It was a schedule.',
        'The people running the Dockyards call themselves the Cinder Wardens. They hold checkpoints, they issue receipts, and they take a percentage of everything that moves - fuel, food, medicine - on a timetable nobody voted for.',
        'They are not raiders. That is the part that should worry you.',
      ],
    },
  },
  {
    id: 'substation-hill', name: 'Substation Hill', act: 2, antagonist: 'the Cinder Wardens',
    blurb: 'A fortified high point overlooking the grid.',
    intro: {
      title: 'Substation Hill',
      body: [
        'The Wardens hold the hill, and the hill holds the switchgear for half of Ashport.',
        'They are not stripping it for copper. They are *maintaining* it - greased breakers, swept bays, a log book with entries as recent as last week.',
        "Somebody is keeping this city's grid alive and choosing not to turn it on. Get up the hill and find out who they are doing it for.",
      ],
    },
  },
  {
    id: 'old-town', name: 'Old Town', act: 2, antagonist: 'the Cinder Wardens',
    blurb: 'Narrow streets, heavier resistance.',
    intro: {
      title: 'Old Town',
      body: [
        'Narrow streets, stone, and a Warden garrison that has had three years to decide where it wants you to walk.',
        "The ledgers from the Hill all route through an office in Old Town, and every one of them carries the same stamp: a cinder over a wrench. You have seen it before - on a tithe sheet in a dead man's desk in Market Row.",
        'Ammunition is short. Take what you need off them.',
      ],
    },
  },
  {
    id: 'uptown', name: 'Uptown', act: 3, antagonist: 'Halcyon Systems',
    blurb: 'What is left of corporate Ashport.',
    intro: {
      title: 'Uptown',
      body: [
        "The cinder-and-wrench is a subcontractor stamp. It belongs to Halcyon Systems, who ran Ashport's grid, Ashport's water, and - it turns out - Ashport's security contracts.",
        'The Cinder Wardens were never a militia. They are a contract still being executed, three years after the last person with authority to cancel it stopped answering.',
        'Uptown is where the contract was written.',
      ],
    },
  },
  {
    id: 'spire', name: 'The Spire', act: 3, antagonist: 'Halcyon Systems',
    blurb: 'Old Halcyon HQ - grid control, for whoever holds it.',
    intro: {
      title: 'The Spire',
      body: [
        'The Blackout was not a transformer chain-failure. It was a cascade Halcyon could have arrested in eleven minutes and did not, because arresting it meant admitting it had started on their side of the meter.',
        'Every switch in Ashport still answers to one room at the top of the Spire.',
        'Take the room. Then give it away - to Riverside, to the Row, to the Dockyards, to whoever is left. A grid one company can switch off is not a grid. It is a leash.',
      ],
    },
  },
];

export const DISTRICT_ORDER: string[] = DISTRICTS.map((d) => d.id);

/** One of Act 1's ten story missions. Handcrafted end to end: each one owns a real 48x32 `MapDef` under
 *  `data/maps/story/`, designed around its own objective type. No two share a layout. */
export interface StoryMissionDef {
  id: string;
  name: string;
  district: string; // a District.id
  act: 1 | 2 | 3;
  /** Two or three sentences of setup, spoken in the crew's voice. */
  blurb: string;
  objective: string;
  /** The beat the mission leaves behind, shown as a debrief once it is completed. See STORY.md. */
  outcome: string;
  map: MapDef;
}

/**
 * Act 1's ten story missions, five per district, in play order. Completing all five in a district unlocks the
 * next one (see core/campaign.ts's `completeStoryMission`). Acts 2 and 3 have districts but no missions yet -
 * STORY.md's section 6 has the beats they should be written from.
 */
export const STORY_MISSIONS: StoryMissionDef[] = [
  // ---------------------------------------------------------------- Riverside
  {
    id: 'lights-out', name: 'Lights Out', district: 'riverside', act: 1,
    blurb: 'The substation two blocks from the safehouse still has a working feeder - the Jackals just got there first and fenced it. Get inside, throw both breakers, and Riverside has light for the first time in three years.',
    objective: 'Throw both breakers in the substation compound. Or eliminate every enemy.',
    outcome: 'The feeder holds. A man named Abel Cortez climbs out of the basement where he has been rationing a case of water for nine days, and asks who he has to shoot to stay.',
    map: LIGHTS_OUT,
  },
  {
    id: 'signal-fire', name: 'Signal Fire', district: 'riverside', act: 1,
    blurb: 'Power means the relay on Kestrel Street can broadcast. Four rounds of carrier tone is enough for anyone still listening to find us - and enough for every Jackal in the district to find the roof.',
    objective: 'Start the relay and hold the roof for 4 rounds. Or eliminate every enemy.',
    outcome: 'The tone goes out into a city with nothing left to answer it. Nothing does, that night. Something answers three days later, in code, from the Dockyards, and it is not friendly.',
    map: SIGNAL_FIRE,
  },
  {
    id: 'cold-storage', name: 'Cold Storage', district: 'riverside', act: 1,
    blurb: "Bellweather's packing plant has been sealed since the Blackout, which is another way of saying nobody has eaten what is in it. Abel knows the door codes. The Jackals got there this morning.",
    objective: 'Get 3 units to the dock at the far end of the plant. Or eliminate every enemy.',
    outcome: 'Four hundred kilos of sealed protein and a working generator, which is more than Riverside has seen in a year. Abel stops asking whether he can stay.',
    map: COLD_STORAGE,
  },
  {
    id: 'the-pumphouse', name: 'The Pumphouse', district: 'riverside', act: 1,
    blurb: 'Light and food, and still everyone is boiling river water. Dawes Street still has pressure in the mains - three valves and a sluice board stand between the district and something coming out of a tap.',
    objective: 'Turn all three valves. Or eliminate every enemy.',
    outcome: 'Water, brown for an hour and then clear. On the sluice board, under three years of grime, a maintenance sticker: HALCYON SYSTEMS - DO NOT OPERATE WITHOUT AUTHORISATION. Nobody in Riverside has heard the name.',
    map: PUMPHOUSE,
  },
  {
    id: 'the-tollgate', name: 'The Tollgate', district: 'riverside', act: 1,
    blurb: "Halloway has held the Kestrel Bridge since the second winter and taxes everything that crosses it, which now includes us. There is no way around a bridge. Riverside is not ours until he isn't.",
    objective: 'Eliminate Halloway. Or eliminate every enemy.',
    outcome: 'Halloway dies at his own tollgate, and the bridge is just a bridge again. Riverside is the first district in Ashport with power, water and an open road. Word of that travels east, to Market Row, where someone starts keeping a note of it.',
    map: TOLLGATE,
  },
  // -------------------------------------------------------------- Market Row
  {
    id: 'supply-run-market-row', name: 'Supply Run: Market Row', district: 'market-row', act: 1,
    blurb: 'Abel says the covered market still has sealed crates under the collapsed awnings. Low stakes, high value: get in, take what you can carry, and be at the loading bay before the Jackals work out you are there.',
    objective: 'Get 3 units to the loading bay in the east. Or eliminate every enemy.',
    outcome: 'Enough ammunition and gauze to matter, and a name scratched into every crate lid: VEX. The Jackals are not scavengers picking over Market Row. Somebody is running it.',
    map: MARKET_ROW,
  },
  {
    id: 'the-clinic', name: 'The Clinic', district: 'market-row', act: 1,
    blurb: "Saint Brigid's still has a stocked dispensary and a Jackal detail sitting on it, charging by the dose. The console behind the counter releases the cabinets - hold it long enough and the whole stock is ours.",
    objective: "Reach the dispensary console and hold it for 3 rounds. Or eliminate every enemy.",
    outcome: 'Antibiotics, morphine, and four people in the back ward who had been paying for both by the day. Two of them can walk. One of them can shoot.',
    map: THE_CLINIC,
  },
  {
    id: 'the-row-relay', name: 'The Row Relay', district: 'market-row', act: 1,
    blurb: "Vex has a relay of his own on the Row, and every patrol on this side of the river talks through it. Pull both transmitters and the Jackals stop being a district and go back to being a hundred people with guns.",
    objective: 'Pull both transmitters in the tower. Or eliminate every enemy.',
    outcome: "The Row goes quiet. In the transmitter room, taped inside the cabinet door, a frequency list in a careful hand - and at the bottom, one frequency that is not a Jackal frequency at all. It is signed with a cinder over a wrench.",
    map: ROW_RELAY,
  },
  {
    id: 'the-night-market', name: 'The Night Market', district: 'market-row', act: 1,
    blurb: "Sable does the counting for Vex: who pays, who eats, who is behind. She works the night market out of a locked counting house, in the middle of four hundred tarpaulins you cannot see through.",
    objective: 'Eliminate Sable. Or eliminate every enemy.',
    outcome: "Sable's ledger is not a ledger of what the Jackals took. It is a ledger of what they handed over, quarterly, to somebody else - and the last four quarters are marked PAID under the same cinder-and-wrench stamp.",
    map: NIGHT_MARKET,
  },
  {
    id: 'jackals-den', name: "The Jackals' Den", district: 'market-row', act: 1,
    blurb: 'Vex runs the district out of the freight warehouse on the east end, behind a dock wall and five rows of shelving. Take the district by taking him - everything the Jackals have is held together by the fact that nobody has.',
    objective: 'Eliminate Vex, the Jackal leader. Or eliminate every enemy.',
    outcome: 'Vex dies in his own office. The Jackals scatter within the week, and Market Row belongs to whoever feeds it. In his desk: a fuel-tithe schedule, countersigned, quarterly, by the Cinder Wardens of the Dockyards - and above their mark, the stamp of the company that used to run the lights.',
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
