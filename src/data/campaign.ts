import type { AiProfileId } from './aiProfiles';
import { TRAINING_GROUNDS, type MapDef } from './trainingGrounds';

/** A node on the campaign map (5) - one district of Ashport. See ROADMAP.md's "Story" section for the full premise. */
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

/** One of the four fixed Act 1 story missions (see ROADMAP.md's Act 1 table). Handcrafted, not generated -
 *  the map is a placeholder (Training Grounds' layout) until real per-mission maps are authored; see ROADMAP.md
 *  #5's Resolved section for why that's scoped out of this feature. */
export interface StoryMissionDef {
  id: string;
  name: string;
  district: string; // a District.id
  blurb: string;
  objective: string;
  map: MapDef;
}

/** Act 1's four story missions, in play order. Later acts are unwritten (see DISTRICTS above). */
export const STORY_MISSIONS: StoryMissionDef[] = [
  {
    id: 'lights-out', name: 'Lights Out', district: 'riverside',
    blurb: "Clear the block around the crew's dead substation and throw the switch to power the safehouse. First taste of the loop.",
    objective: 'Reach the substation switch and hold it. Or eliminate every enemy.',
    map: TRAINING_GROUNDS,
  },
  {
    id: 'signal-fire', name: 'Signal Fire', district: 'riverside',
    blurb: 'Get a rooftop relay running to find out who else is still out there - the Jackals converge on the broadcast.',
    objective: 'Hold the rooftop relay while it broadcasts. Or eliminate every enemy.',
    map: TRAINING_GROUNDS,
  },
  {
    id: 'supply-run-market-row', name: 'Supply Run: Market Row', district: 'market-row',
    blurb: 'Routine scavenging for ammo and medkits - low stakes, good practice for delegating a phase.',
    objective: 'Grab the marked crates and reach the exfil zone. Or eliminate every enemy.',
    map: TRAINING_GROUNDS,
  },
  {
    id: 'jackals-den', name: "The Jackals' Den", district: 'market-row',
    blurb: 'Hit the warehouse the Jackals run their district out of and take down their leader. Act 1 finale.',
    objective: 'Eliminate the Jackal leader. Or eliminate every enemy.',
    map: TRAINING_GROUNDS,
  },
];

/** A generated "supply run"-style mission (5): parameterized by difficulty, not hand-authored. */
export interface GeneratedMissionDef {
  id: string;
  name: string;
  blurb: string;
  map: MapDef;
  enemyProfile: AiProfileId;
  reward: number; // campaign currency; nothing spends it yet - see #6 (base building)
}

export const SUPPLY_RUN_NAMES = ['Salvage Run', 'Quiet Extraction', 'Night Patrol', 'Blockade Run', 'Perimeter Sweep', 'Last Convoy'];

/** Enemy-profile pools by difficulty tier (0 = easiest); `core/campaign.ts` picks a tier from completion count. */
export const SUPPLY_RUN_PROFILE_TIERS: AiProfileId[][] = [
  ['easy', 'easy', 'standard'],
  ['standard', 'standard', 'camper'],
  ['standard', 'hard', 'camper'],
  ['hard', 'hard', 'ambush'],
];

/** The map every generated mission uses (Training Grounds' layout, as a stand-in - see the StoryMissionDef doc above). */
export const SUPPLY_RUN_MAP: MapDef = TRAINING_GROUNDS;
