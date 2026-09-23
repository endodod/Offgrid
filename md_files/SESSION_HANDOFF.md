# Session handoff

See CLAUDE.md for when to update this file. Everything below is committed; the working tree should be clean.

## What landed this session (feature 10, polish pass)

The plan is ROADMAP.md feature 10 (table of 10a-10k with status). Each item is one commit:

| Commit | What |
|---|---|
| `e6e98e0` | 10a/10b: HiDPI board (`RES`), combat log visible to everyone, `confirmModal`, generated key help, hostile counter; camera drag/arrow pan, `=`/`-`/Ctrl+wheel zoom, `C` centre |
| `c4056af` | 10c: mid-mission autosave (`core/save.ts`, `ui/missionStore.ts`) and Resume on the home screen |
| `cafa07a` | 10d: event playback (`ui/anim.ts`): walks, tracers, grenades, shake, phase banner; move events carry `path` |
| `e3d387b` | 10e/10f: procedural WebAudio sounds (`ui/audio.ts`); Settings "Game" group (`ui/prefs.ts`), colour-blind palette |
| `5427441` | 10g: mission results table in the end banner; `Unit.shotsFired/shotsHit` |
| `facdc67` | 10h: end-turn confirmation, undo for a move that revealed nothing (`Z`) |
| `7183f58` | 10i: soft fog-of-war overlay, time-of-day tint, animated weather (`Prefs.weatherFx`) |
| `194d61a` | 11: base overhaul - ten stations, wounds carry over, squad pick + recon briefing, fabricator/parts |
| `a86f091` | 12: home page rework (two tiles, Settings top left) and the Lore screen |

427 tests pass, `tsc` clean, `npm run build` clean. Each item was also driven in headless Chromium with no
console errors.

## Next up

Feature 10 (the polish pass, 10a-10k) is complete, as are 11-17 and 10j. Next, in order:

1. **Balance pass.**
   - The roster economy (feature 13): hire cost, candidate count and permadeath have not been simulated. Is
     salvage enough to replace losses and build stations?
   - Balanced auto-run's 50% retreat (16's sim table: Rush beats Balanced on objective maps).
2. **Act 2 missions.** The pods and reinforcement knobs (10j) are ready for them, and need per-mission tuning:
   they swing from 5% to 100% player wins by map.
3. **Feature 9, the visual rehaul.**

## Gotchas from this session

- **The renderer draws in logical units through `ctx.setTransform(RES, ...)`.** Anything converting mouse or
  scroll positions must use the map's width in tiles (see `ui/input.ts`, `Viewport.cssPerLogical`), never
  `canvas.width / TILE`.
- **The screen deliberately lags the state during playback.** HP, deaths, log lines (`LogLine.at`) and tooltips
  wait for their event's moment. Anything new that reads unit state for display should check
  `session.animating()` or the `AnimFrame` (`hpPending`, `upright`, `fading`), or it will spoil results.
- **`Session.onChange` fires on every hover.** Don't do real work in it unless it has changed (see the focus
  guard in main.ts: the camera used to snap back after every pan).
- **Bumping `SAVE_VERSION` in `core/save.ts` is how to change `GameState`/`Unit` shape safely:** older
  mid-mission saves are then ignored instead of half-read.
- **Headless browser driving:** Playwright lives in the npx cache
  (`~/AppData/Local/npm-cache/_npx/5e2e484947874241/node_modules/playwright`), with `.env.local` setting
  `VITE_DEBUG=true` so `window.session` exists. Run `npx vite --port 5199` in the background.

## Things that are worth knowing and are not obvious from the code

- **`afterMission` in `core/roster.ts` runs last in `Campaign.reportEnd`,** after `recordMissionGear` (which
  needs the dead soldier still on the roster to recover their gear) and `applyMissionXp`.
- **A campaign squad ignores the classes the map's player spawns were authored with** (13): members take the
  spawn *tiles* in order. The squad is capped at the number of player spawns.
- **Soldier ids:** founders are `sniper`, `assault`, `soldier`, `medic` and `tank`; recruits are `r<n>`. Tests
  lean on the founder ids.
- **Campaign missions report exactly once, at the checkpoint that decides them** (main.ts `reported` flag),
  or when the player retreats. Menu in a campaign mission is a retreat. A single mission's Menu still just
  saves and leaves.
- **`CampaignState.deployed` locks soldiers while a campaign mission is pending.** Any new code that changes
  a soldier's gear or removes one must check `onMission`.
- **Weather animation is a ~30 fps `setTimeout` in main.ts's `frame`**, and only runs while weather is moving,
  the game screen is visible and nothing else is animating. It is a pure function of time, so there is no
  particle state to save.

- **Enemy counts must sit near parity with the player's five.** The first pass at the 48x32 maps used 8-10
  enemies each; the sim showed ~100% enemy wins on all ten. A bigger map buys distance and routes, not bodies.
  5-7 is the working range, 7 only for a finale that expects levels. This is the single most important thing
  to remember when authoring Act 2.
- **High cover in lines, never in slabs.** Double rows of high cover make a map unflankable and AI-vs-AI runs
  time out (~60% on an early Jackals' Den). Single rows with a clear aisle behind each fixed it.
- **The AI opens doors now (10j),** except on maps with `aiOpensDoors: false` (the two boss rooms). The note
  below describes the old behaviour, which those two maps still rely on: anything sealed behind a closed door
  was unreachable *to the AI*, which means
  (a) sealing an enemy there makes "eliminate every enemy" unwinnable until the player breaches, and (b) the
  sim reports those missions as near-100% draws. That is deliberate for the two boss rooms (Vex, Halloway) and
  deliberately avoided everywhere else - see Lights Out's header comment for the full reasoning.
- **`npm run sim -- --map <id>` now defaults to the map's own shipped enemy profile**, not `standard`. Pass
  `--objective player` for `hold` missions or they read as pure elimination. `--max-turns 70` was tried for the
  big maps and changed nothing: the remaining draws are genuine AI stalls, not the 40-turn cap.
- **`npm run map -- LIGHTS_OUT`** prints any authored map as ASCII with spawns/doors/switches/chests/pickups/
  waypoints overlaid and flags anything standing on a tile it cannot stand on. It is much faster than running
  the test suite while authoring.
- **Gear is now counted, not just "unlocked".** `CampaignState.inventory` replaced `unlockedGear`;
  `recordMissionGear` reconciles with a multiset diff per class. Old saves migrate in `migrateCampaign`.
- **Supply-run pool entries store a `templateId`, not a `MapDef`.** Editing a supply map reaches campaigns
  already in progress. Pool entries saved under the old shape are dropped and re-rolled.
- **The bash tool in this environment truncates long heredocs.** Several multi-hundred-line `python - <<'PY'`
  blocks failed with "unexpected EOF". Write the script to the scratchpad with the Write tool and run it with
  `python <path>` instead.

## Earlier notes: nothing in progress from the previous session

The working tree is clean. The next pieces of work, in the order I would take them:

1. **Act 2 missions.** Five per district for Dockyards, Substation Hill and Old Town. The districts, their
   briefing text and the unlock mechanism all exist; only the missions are missing. `md_files/STORY.md` §6 has
   the five authoring rules and Act 2's three known beats, and §3 has the Halcyon reveal the act has to land.
2. **Feature 9, the visual rehaul** (`md_files/ROADMAP.md`). Still the last item in the numbered sequence, and
   now genuinely the last presentation gap: the DOM UI has had its pass, but `render/renderer.ts` is still
   `ctx.fillRect` primitives for units, tiles, doors, pickups and loot.
3. **A per-instance roster.** Still not needed - every mission fields one of each class - but the story now
   names recruits (Abel Cortez in Lights Out, the shooter from The Clinic) who have nowhere to live. That is
   the first thing that will actually want it.
