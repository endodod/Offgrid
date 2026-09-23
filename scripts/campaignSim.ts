// Whole-campaign simulation (balance pass after 13/15): plays Act 1 campaigns end to end with the auto-run AI
// fighting and a simple commander running the base, and reports how the economy holds up.
//   npm run campaign-sim -- [--n 12] [--seed 1] [--max-missions 45] [--profile friendly] [--verbose]
//
// The commander, between missions:
//   - picks the next story mission when at least 4 soldiers are fit (>= 60% HP), otherwise the best-paying
//     supply run on offer;
//   - deploys the default squad (the healthiest, highest-level 5 not in a bed);
//   - first hires the cheapest candidate while the roster is under 7, keeping 60 salvage in hand;
//   - then builds stations in a fixed order whenever it can afford one with 60 to spare;
//   - admits the worst-hurt soldiers to the infirmary; scraps locker overflow (duplicates first).
//   - retreats from a fight once only 2 of a squad of 3+ are still standing.
import { baseGameOptions, infirmaryBeds } from '../src/core/base';
import {
  availableStoryMissions, newCampaign, resolveSupplyRun, upgradeFacility, type CampaignState,
} from '../src/core/campaign';
import { trimLocker } from '../src/core/crafting';
import { admit, defaultSquad, deploySquad, endMission, hire, hireCost, maxHp, soldierHp } from '../src/core/roster';
import { runAiTurn } from '../src/core/ai';
import { createGame } from '../src/core/state';
import { RULES } from '../src/data/rules';
import { STORY_MISSIONS } from '../src/data/campaign';
import type { FacilityId } from '../src/data/base';
import type { AiProfileId } from '../src/data/aiProfiles';
import type { MapDef } from '../src/data/trainingGrounds';

const args = process.argv.slice(2);
const num = (f: string, d: number) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };
const str = (f: string, d: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const N = num('--n', 12);
const seed0 = num('--seed', 1);
const maxMissions = num('--max-missions', 45);
const profile = str('--profile', 'friendly') as AiProfileId;
const verbose = args.includes('--verbose');

const BUILD_ORDER: FacilityId[] = [
  'infirmary', 'barracks', 'recruitment', 'medstation', 'workbench', 'trainingRoom', 'warRoom', 'commsRelay',
  'reconUplink', 'fabricator', 'locker', 'infirmary', 'barracks', 'medstation', 'workbench',
];
const ACT1 = STORY_MISSIONS.filter((m) => m.act === 1).length;
const fit = (cs: CampaignState) => cs.roster.filter((s) => soldierHp(s) / maxHp(s.cls) >= 0.6).length;

interface Run {
  missions: number; storyDone: number; wins: number; losses: number; deaths: number; hires: number;
  salvageEarned: number; salvageSpent: number; stations: number; volunteers: number; finishedAt: number | null;
  minRoster: number; salvageAtEnd: number; retreats: number;
}

function playOne(seed: number): Run {
  const cs = newCampaign(seed);
  const run: Run = { missions: 0, storyDone: 0, wins: 0, losses: 0, deaths: 0, hires: 0, salvageEarned: 0, salvageSpent: 0, stations: 0, volunteers: 0, finishedAt: null, minRoster: 5, salvageAtEnd: 0, retreats: 0 };
  let buildStep = 0;
  for (let m = 0; m < maxMissions; m++) {
    // --- between missions: the commander ---
    while (cs.roster.length < 7 && cs.recruits.length) { // hire
      const cheapest = [...cs.recruits].sort((a, b) => hireCost(a) - hireCost(b))[0];
      if (cs.currency - hireCost(cheapest) < 60) break;
      const before = cs.currency;
      if (hire(cs, cheapest.id) !== null) break;
      run.salvageSpent += before - cs.currency;
      run.hires++;
    }
    for (;;) { // build
      const id = BUILD_ORDER[buildStep];
      if (!id) break;
      const before = cs.currency;
      if (upgradeFacility(cs, id) === null) { run.salvageSpent += before - cs.currency; run.stations++; buildStep++; continue; }
      break;
    }
    for (const s of [...cs.roster].sort((a, b) => soldierHp(a) / maxHp(a.cls) - soldierHp(b) / maxHp(b.cls))) {
      if (cs.infirmary.length >= infirmaryBeds(cs.base) || soldierHp(s) / maxHp(s.cls) >= 0.5) break;
      admit(cs, s.id);
    }
    trimLocker(cs);

    // --- pick and play a mission ---
    const story = availableStoryMissions(cs).find((x) => x.act === 1);
    if (!story) { run.finishedAt = run.missions; break; }
    const useStory = fit(cs) >= 4 || !cs.supplyRunPool.length;
    const supply = [...cs.supplyRunPool].sort((a, b) => b.reward - a.reward)[0];
    const [id, map]: [string, MapDef] = useStory ? [story.id, story.map] : [supply.id, resolveSupplyRun(supply)];
    const squad = defaultSquad(cs, map.spawns.player.length);
    if (!squad.length) { for (const s of cs.infirmary.slice()) squad.push(s); }
    const bonus = baseGameOptions(cs.base);
    const deployed = { ...deploySquad(cs, map, squad), playerReserveMult: 1 + bonus.reserveMultBonus, medkitBonus: bonus.medkitBonus, gadgetUsesBonus: bonus.gadgetUsesBonus };
    const s = createGame(deployed, seed * 1000 + m, { objectiveCapture: 'player', playerProfile: profile });
    // A sensible commander retreats once the fight is lost - down to 2 still standing out of a bigger squad -
    // instead of feeding the rest to it (15: survivors come home, downed ones on 1 HP).
    let retreated = false;
    while (!s.winner && s.turn <= RULES.maxTurns) {
      if (s.phase === 'player' && squad.length >= 3 && s.units.filter((u) => u.team === 'player' && u.alive && !u.downed).length <= 2) { retreated = true; break; }
      runAiTurn(s, s.phase); s.events.length = 0;
    }
    const won = s.winner === 'player';
    const before = cs.currency;
    const rosterBefore = cs.roster.length;
    const lines = endMission(cs, id, s.units, won ? 'won' : retreated ? 'retreat' : 'lost');
    if (retreated) run.retreats++;
    run.salvageEarned += Math.max(0, cs.currency - before);
    run.missions++;
    if (won) run.wins++; else run.losses++;
    if (won && useStory) run.storyDone++;
    const died = s.units.filter((u) => u.team === 'player' && !u.alive).length;
    run.deaths += died;
    if (lines.some((l) => /^Volunteers/.test(l))) run.volunteers++;
    run.minRoster = Math.min(run.minRoster, cs.roster.length, rosterBefore - died);
    if (verbose) console.log(`  #${m + 1} ${useStory ? 'story ' : 'supply'} ${map.name.padEnd(28)} ${won ? 'WON ' : retreated ? 'RETR' : s.winner === 'enemy' ? 'LOST' : 'DRAW'} squad ${squad.length} dead ${died} roster ${cs.roster.length} salvage ${cs.currency}`);
  }
  run.salvageAtEnd = cs.currency;
  if (run.finishedAt === null && run.storyDone >= ACT1) run.finishedAt = run.missions;
  return run;
}

const runs: Run[] = [];
for (let i = 0; i < N; i++) {
  if (verbose) console.log(`campaign ${i + 1} (seed ${seed0 + i})`);
  runs.push(playOne(seed0 + i));
}
const avg = (f: (r: Run) => number) => (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(1);
const finished = runs.filter((r) => r.finishedAt !== null);
console.log(`\n${N} Act 1 campaigns, squad AI '${profile}', up to ${maxMissions} missions each`);
console.log(`Finished Act 1: ${finished.length}/${N}${finished.length ? `, in ${avg((r) => r.finishedAt ?? 0)} missions on average (of those: ${(finished.reduce((a, r) => a + (r.finishedAt ?? 0), 0) / finished.length).toFixed(1)})` : ''}`);
console.log(`Missions played ${avg((r) => r.missions)} · won ${avg((r) => r.wins)} · lost ${avg((r) => r.losses)} (retreats ${avg((r) => r.retreats)}) · story done ${avg((r) => r.storyDone)}/${ACT1}`);
console.log(`Soldiers killed ${avg((r) => r.deaths)} · hired ${avg((r) => r.hires)} · volunteer bailouts ${avg((r) => r.volunteers)} · lowest roster ${avg((r) => r.minRoster)}`);
console.log(`Salvage earned ${avg((r) => r.salvageEarned)} · spent ${avg((r) => r.salvageSpent)} · left ${avg((r) => r.salvageAtEnd)} · stations built ${avg((r) => r.stations)}`);
