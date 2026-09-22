# Session handoff

See CLAUDE.md for when to update this file. Everything below is committed; the working tree should be clean.

## What landed this session

| Commit | What |
|---|---|
| `95b8844` | Story bible (`md_files/STORY.md`) and the first pass of hand-authored maps, replacing feature 5's placeholder "every campaign mission uses Training Grounds' layout". Supply runs became template x complication x difficulty tier. `scripts/sim.ts` gained `--map`. |
| `bd7365d` | Full UI rework: design system, segmented controls instead of every `<select>`, toggle switches instead of checkboxes, pointer-based drag-and-drop loadout screen, story modal, board zoom/scroll, inline SVG icon set. |
| `8eb9be8` | Act 1 expanded to ten 48x32 story levels (five per district), a map-composition toolkit, district briefings and mission debriefs, and a full balance retune. |
| (this one) | `npm run map -- <MAP_NAME>` promoted from a scratch script to `scripts/mapPreview.ts`. |

398 tests pass (`npx vitest run`), `npx tsc --noEmit` is clean, and the whole loop was driven in a headless
browser with no console errors: briefing -> deploy -> select/move/end turn/enemy phase/open a door at M zoom
-> win -> debrief -> next district's briefing -> loadout drag-and-drop -> base -> map builder.

## Things that are worth knowing and are not obvious from the code

- **Enemy counts must sit near parity with the player's five.** The first pass at the 48x32 maps used 8-10
  enemies each; the sim showed ~100% enemy wins on all ten. A bigger map buys distance and routes, not bodies.
  5-7 is the working range, 7 only for a finale that expects levels. This is the single most important thing
  to remember when authoring Act 2.
- **High cover in lines, never in slabs.** Double rows of high cover make a map unflankable and AI-vs-AI runs
  time out (~60% on an early Jackals' Den). Single rows with a clear aisle behind each fixed it.
- **The AI does not open doors.** Anything sealed behind a closed door is unreachable *to the AI*, which means
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

## Nothing is in progress

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
