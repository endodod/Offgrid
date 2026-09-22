// Bot-vs-bot balance simulation:
//   npm run sim -- [--n 200] [--seed 1] [--max-turns 40] [--objective none|player|both]
//                  [--time-of-day midday|morning|afternoon|midnight] [--weather clear|cloudy|rain|fog|stormy]
//                  [--no-ai-revive] [--enemy-profile standard|easy|hard|camper|ambush] [--player-profile ...]
//                  [--reserve-mult 1] (ammo economy, 4 - e.g. 0.5 for a scarcer mission)
//                  [--player-level 1] (leveling, 8 - every player class starts at this level with its
//                  perks-so-far equipped up to its slot count; 0/omitted = no progress, matching a fresh campaign)
//                  [--map training-grounds|lights-out|signal-fire|market-row|jackals-den|fuel-depot|
//                        pharmacy-row|rail-yard|underpass|waterworks] (which layout to simulate)
import { RULES, type ObjectiveCapture } from '../src/data/rules';
import { CLASS_ORDER, CLASSES, type ClassId } from '../src/data/units';
import type { AiProfileId } from '../src/data/aiProfiles';
import { TRAINING_GROUNDS, type ClassProgress, type MapDef } from '../src/data/trainingGrounds';
import {
  FUEL_DEPOT, JACKALS_DEN, LIGHTS_OUT, MARKET_ROW, PHARMACY_ROW, RAIL_YARD, SIGNAL_FIRE, UNDERPASS, WATERWORKS,
} from '../src/data/maps';
import { LEVEL_PATHS } from '../src/data/leveling';
import type { TimeOfDayId } from '../src/data/timeOfDay';
import type { WeatherId } from '../src/data/weather';
import { playMatch, type MatchResult } from '../src/core/sim';
import type { Team } from '../src/core/types';

const args = process.argv.slice(2);
const num = (flag: string, fallback: number) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const str = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const n = num('--n', 200);
const seed0 = num('--seed', 1);
const maxTurns = num('--max-turns', RULES.maxTurns);
// 'none' (default) = pure elimination, so the numbers measure combat balance. 'both' lets either AI win by capture.
const oi = args.indexOf('--objective');
const objectiveCapture = (oi >= 0 ? args[oi + 1] : 'none') as ObjectiveCapture;
const timeOfDay = str('--time-of-day', 'midday') as TimeOfDayId;
const weather = str('--weather', 'clear') as WeatherId;
const aiRevive = !args.includes('--no-ai-revive');
const enemyProfile = str('--enemy-profile', 'standard') as AiProfileId;
const playerProfile = str('--player-profile', 'standard') as AiProfileId;
const reserveMult = num('--reserve-mult', 1);
const playerLevel = num('--player-level', 0);

/** Every hand-authored layout, by the id `--map` takes. Defaults to Training Grounds, the historical baseline. */
const MAPS: Record<string, MapDef> = {
  'training-grounds': TRAINING_GROUNDS,
  'lights-out': LIGHTS_OUT, 'signal-fire': SIGNAL_FIRE, 'market-row': MARKET_ROW, 'jackals-den': JACKALS_DEN,
  'fuel-depot': FUEL_DEPOT, 'pharmacy-row': PHARMACY_ROW, 'rail-yard': RAIL_YARD, 'underpass': UNDERPASS,
  'waterworks': WATERWORKS,
};
const mapId = str('--map', 'training-grounds');
const baseMap = MAPS[mapId];
if (!baseMap) {
  console.error(`Unknown --map "${mapId}". Known: ${Object.keys(MAPS).join(', ')}`);
  process.exit(1);
}

/** Every perk granted by `level` or below, with as many equipped as the level's own slot count allows - the
 *  same rule core/leveling.ts's `gainXp`/`equipPerk` would produce for a class that actually leveled up there. */
function progressAtLevel(cls: ClassId, level: number): ClassProgress {
  const path = LEVEL_PATHS[cls];
  const perkPool = path.filter((d) => d.level <= level && d.perksGranted).flatMap((d) => d.perksGranted!);
  const slots = path.filter((d) => d.level <= level && d.slotUnlock).length;
  return { xp: 0, level, perkPool, equippedPerks: perkPool.slice(0, slots) };
}

const map = playerLevel > 0
  ? { ...baseMap, startingProgress: Object.fromEntries(CLASS_ORDER.map((cls) => [cls, progressAtLevel(cls, playerLevel)])) }
  : baseMap;

const results: MatchResult[] = [];
for (let i = 0; i < n; i++) {
  results.push(playMatch(map, seed0 + i, { objectiveCapture, timeOfDay, weather, aiRevive, enemyProfile, playerProfile, reserveMult }, maxTurns));
}

const pct = (k: number) => `${((100 * k) / n).toFixed(1)}%`;
const count = (f: (r: MatchResult) => boolean) => results.filter(f).length;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log(`${baseMap.name}: ${n} AI-vs-AI matches (seeds ${seed0}..${seed0 + n - 1}), max ${maxTurns} turns, ` +
  `objective capture: ${objectiveCapture}, time of day: ${timeOfDay}, weather: ${weather}, AI revive: ${aiRevive}, ` +
  `enemy profile: ${enemyProfile}, player profile: ${playerProfile}, reserve mult: ${reserveMult}, player level: ${playerLevel || 1}`);
console.log(`\nWin rate   player ${pct(count((r) => r.winner === 'player'))}   enemy ${pct(count((r) => r.winner === 'enemy'))}   ` +
  `draw ${pct(count((r) => r.winner === 'draw'))}`);
console.log(`Decided by elimination ${pct(count((r) => r.via === 'elimination'))}   objective ${pct(count((r) => r.via === 'objective'))}   ` +
  `timeout ${pct(count((r) => r.via === 'timeout'))}`);
console.log(`Average length ${avg(results.map((r) => r.turns)).toFixed(1)} turns`);
const allUnits = results.flatMap((r) => r.units);
console.log(`Revives: ${avg(results.map((r) => r.units.reduce((a, u) => a + u.revives, 0))).toFixed(2)} per match   ` +
  `downed-but-not-revived at match end: ${pct(allUnits.filter((u) => u.downedAtEnd).length)} of all units`);

console.log('\nPer class (averages per match)');
console.log('team    class    dmg dealt  dmg taken  kills  revives  survival  reserve used  ran dry');
for (const team of ['player', 'enemy'] as Team[]) {
  for (const cls of CLASS_ORDER as ClassId[]) {
    const rows = results.flatMap((r) => r.units.filter((u) => u.team === team && u.cls === cls));
    if (!rows.length) continue; // this team does not field the class
    console.log(
      `${team.padEnd(8)}${CLASSES[cls].name.padEnd(9)}` +
      `${avg(rows.map((u) => u.dmgDealt)).toFixed(2).padStart(9)}  ${avg(rows.map((u) => u.dmgTaken)).toFixed(2).padStart(9)}  ` +
      `${avg(rows.map((u) => u.kills)).toFixed(2).padStart(5)}  ${avg(rows.map((u) => u.revives)).toFixed(2).padStart(7)}  ` +
      `${pct(rows.filter((u) => u.survived).length * (n / rows.length)).padStart(8)}  ` +
      `${avg(rows.map((u) => u.reserveUsed)).toFixed(2).padStart(12)}  ${pct(rows.filter((u) => u.ranDry).length * (n / rows.length)).padStart(7)}`,
    );
  }
}
console.log('\nNote: the simulated AI does not use gadgets (enemies have none by design), so player-side numbers exclude them.');
