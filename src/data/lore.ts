/**
 * The Lore screen's fixed text (home page rework). Written from md_files/STORY.md, but only what a player
 * should know before the first mission: the premise, the city and who they will meet in Act 1. The Cinder
 * Wardens are a rumour here, and Halcyon's part in the Blackout is never mentioned - it's Act 3's reveal
 * (STORY.md §2), seeded in the missions themselves.
 */
export interface LoreSection {
  title: string;
  body: string[];
}

export const LORE_WORLD: LoreSection[] = [
  {
    title: 'The Blackout',
    body: [
      'Three years ago the regional grid went down and never came back. The official line was a transformer chain-failure. Nobody who lived through it believes that anymore.',
      'Ashport is a mid-sized river city that ran on one utility contractor and one substation network. Without power there is no water treatment, no refrigeration, no comms, and quickly no reason for anyone to keep pretending the city is one place. It split along the lines that were already there: every district became whoever had the guns and the fuel.',
    ],
  },
  {
    title: 'The Lamplighters',
    body: [
      'You. Five people who were not anybody before the Blackout: a sniper, an assault specialist, a rifleman, a medic and a tank, working out of a dead substation in Riverside and doing supply runs to stay fed.',
      'What turns that into a campaign is a working theory: someone in this city can still throw switches. Relighting a district is the goal. Clear it, hold it, keep it.',
      'The lights going back on is not a reward for winning. It is the thing that makes you visible.',
    ],
  },
  {
    title: 'The Jackals',
    body: [
      'Scavenger raiders who find the one thing in a district that still works and sit on it. Aggressive and sloppy, and they punish impatience less than they punish nothing at all.',
      'They hold Riverside\'s only working feeder behind a chain-link fence, and Market Row beyond it. Lately they have started keeping books, which raiders do not do.',
    ],
  },
  {
    title: 'Beyond Market Row',
    body: [
      'Down on the waterfront there is talk of checkpoints, receipts and a "tithe" taken on a timetable. Whoever runs the Dockyards is not a gang. Nobody who has gone to find out has said much since.',
    ],
  },
];

export const LORE_HOW: LoreSection = {
  title: 'How the campaign works',
  body: [
    'The city is taken one district at a time. Each district has five story missions; finishing all five unlocks the next district and its briefing.',
    'Supply runs are side jobs that pay salvage. Spend it at the base on stations: an infirmary, a fabricator for crafting gear, a recon uplink that shows the target before you deploy, and more.',
    'Your soldiers keep their wounds between missions. Before each mission you pick who deploys; whoever stays home rests. A soldier killed in action is replaced, and their class starts again from level 1.',
  ],
};
