# Session handoff

Working notes so the next session can pick up exactly where this one paused, mid-way through 0d.
Delete or fold this into ROADMAP.md once it's stale - it's a handoff note, not permanent documentation.

## What's committed (this session, in order)

1. `1b9c00e` **Story + Act 1 missions** added to ROADMAP.md (Ashport, the Blackout, the Lamplighters,
   four Riverside missions), plus **Feature 1: weather/time-of-day** (was already mostly implemented
   uncommitted at session start - finished and committed), plus fixes for two pre-existing test failures
   and a stale ASSUMPTIONS.md left by the last map change.
2. `6b06203` **Feature 0a**: hover/tooltip UI clarity pass (move-mode path/AP/danger preview, gadget-mode
   target preview, action-bar button hover/focus tooltips, a move-path arrow on the canvas).
3. `c6e8444` **Feature 0b**: revive mechanic (downed state, bleed-out, the revive action, finishing shots,
   AI revive/finish behaviour).
4. `888afa0` **Feature 0c**: enemy AI habitat + difficulty profiles (`data/aiProfiles.ts`, per-team
   `GameState.aiProfiles`, `planAction` reads them; `standard` is a byte-for-byte regression-safe default).

Each of these has its own **Status: done** section in `md_files/ROADMAP.md` with full design notes,
resolved open questions, and what was deliberately deferred - read those before re-deriving anything.
All were verified with `npx vitest run` (146 tests passing as of `888afa0`) and, for UI-touching ones,
a driven headless browser (see "How to verify UI changes" below) before committing.

## What's uncommitted right now (mid-flight, do not lose)

Mid-way through **extending 0c to support a per-unit AI profile override**, prompted by a mid-session
request: *"in map editor let me choose enemy ai per unit"*. This is a natural, small extension of 0c's
existing per-team profile system (0c's own ROADMAP.md notes already flagged this as "a straightforward
later extension... the `Spawn` tuple would need a 4th element").

Done so far (typechecks clean, all 146 tests still pass - nothing broken, just incomplete):
- `src/data/trainingGrounds.ts`: `Spawn` is now `[ClassId, number, number, AiProfileId?]`.
- `src/core/mapFormat.ts`: `parseMap` validates and round-trips the optional 4th element.
- `src/core/types.ts`: `Unit.aiProfile?: AiProfileId` - a per-unit override slot.
- `src/data/aiProfiles.ts`: added the `friendly` profile (habitat patrol, `retreatBelowHp: 0.5`,
  new `prioritizeObjective` flag) for 0d, and `prioritizeObjective` itself.
- `src/core/ai.ts`: `pickGoal` now takes the whole `AiProfileDef` (not just habitat) and uses
  `prioritizeObjective` to chase a seen objective ahead of a spotted ghost.

**Still to do to finish the per-unit-profile extension:**
1. `src/core/state.ts`'s `createGame` unit-spawning loop: read `spawn[3]` and set it as `aiProfile` on
   the created `Unit` (currently spawns are created without ever looking at a 4th tuple element).
2. `src/core/ai.ts`'s `planAction`: change `const profile = AI_PROFILES[s.aiProfiles[u.team]];` to
   `AI_PROFILES[u.aiProfile ?? s.aiProfiles[u.team]]` so a per-unit override actually takes effect.
3. `src/ui/builder.ts`: the actual ask. Add a `private profile: AiProfileId = 'standard';` field and a
   `<select id="b-profile">` (add the element in `index.html` near `#b-class`, wire it in the
   constructor the same way `#b-class` already is). In `paint()`'s unit-placement branch
   (`tool === 'player' || tool === 'enemy'`), push `[this.cls, x, y, this.profile]` instead of
   `[this.cls, x, y]` - but only meaningfully for `tool === 'enemy'` (player-side profile is inert in
   real play; consider only showing/applying the select when `this.tool === 'enemy'`, mirroring how
   `#b-class` is always visible but the profile picker doesn't need to be for the friendly-unit tool).
   Existing units can't have their profile edited in place without repainting (same limitation class
   selection already has) - that's an acceptable, consistent scope for now.
4. Tests: extend `src/core/aiProfiles.test.ts` with a case or two for the per-unit override winning
   over the team default, and a `mapFormat.test.ts` case for the new spawn validation (unknown profile
   string should throw, a valid one should round-trip through `serializeMap`/`parseMap`).
5. Update ROADMAP.md's 0c section (`md_files/ROADMAP.md`) to mention the per-unit override once it's
   finished - it currently only documents the per-team version.

None of this is committed. `git status --short` will show exactly these five modified files
(`src/core/ai.ts`, `src/core/mapFormat.ts`, `src/core/types.ts`, `src/data/aiProfiles.ts`,
`src/data/trainingGrounds.ts`) with no new untracked files yet.

## 0d itself: not started

The actual 0d feature (friendly/auto-run AI) is **not implemented yet** beyond adding the `friendly`
profile and `prioritizeObjective` above. Still needed, per ROADMAP.md's 0d section:
- `Session.autoRun` toggle in `src/ui/session.ts`, mirroring the existing enemy-phase stepped-generator
  pattern in `endTurn()` (see that method for the exact shape to copy: a `runId`-guarded `setTimeout`
  loop calling `gen.next()`). Kick it off from `finishEnemyPhase()` when `autoRun` is true and it's the
  player's turn; hand control back automatically if a player unit takes a casualty mid-phase (compare
  the alive-and-not-downed player count before/after each step).
- A toggle button in the HUD (`ui/hud.ts` + `index.html`), same pattern as `#ow-toggle`.
- `scripts/sim.ts` already supports `--player-profile friendly` for free (added in 0c) - worth a quick
  sim run to sanity-check the friendly profile's outcomes once auto-run itself exists.
- Decide the deferred scope questions already answered in ROADMAP.md's 0c section as precedent: no
  dedicated mission-results-summary screen for v1 (log + existing win/loss banner + a log line when
  auto-run hands back control cover it); auto-run available on any mission for now (no campaign layer
  to gate it by template yet).

## Known pre-existing issue (not caused by this session, already documented)

Training Grounds' enemy squad spawns right next to the objective courtyard's single doorway. With 5-unit
squads, AI units can jam each other there and never reach combat range in elimination mode (`--objective
none`), and `--objective player|both` is a near-instant, near-deterministic enemy win by capture instead
of a balanced test. This is flagged in `ASSUMPTIONS.md` and `ROADMAP.md`'s #0c section already. When
running the sim to sanity-check anything, use a small hand-built skirmish `MapDef` (see any of the
`--- profile sim ---` style scratch scripts described below) with both squads placed within ~5-6 tiles
of each other on an open `blank(w,h)` map, not `TRAINING_GROUNDS`, or you'll see nothing but draws/timeouts
and wrongly conclude a feature doesn't work.

## How to verify UI changes (workflow used all session)

No `chromium-cli` in this environment. The working pattern:
```
npm install --no-save playwright   # local-only, doesn't touch package.json/package-lock.json
(npm run dev > /tmp/vite.log 2>&1 &)
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
# write a scratch .mjs script under the repo root using `import { chromium } from 'playwright'`,
# launch, page.goto, drive it, page.screenshot(...), read the screenshot with the Read tool
node scratch_whatever.mjs
```
Afterward: delete the scratch `.mjs`/`.png` files, kill the dev server
(`lsof -ti:5173 -sTCP:LISTEN | xargs -r kill`, or the Windows `netstat`/`taskkill` fallback used this
session since `lsof` isn't available in this Git Bash), and `npm uninstall playwright` to restore
`node_modules` to match the committed lockfile. `.env.local` already has `VITE_DEBUG=true` so the debug
panel (`window.session` in the console, fog toggle, time/weather/enemy-AI selectors) is available for
setting up test scenarios without playing a full mission by hand.

## Roadmap order still ahead after 0d

0e (hotkey settings, small) -> 0f (tutorial, depends on 0a/0b-0e) -> 1 (done) -> 2 (doors) -> 3
(objective types) -> 4 (consumables/ammo economy) -> meta-game layer 5-8 (campaign map, base building,
equipment, leveling) -> then the actual Act 1 mission maps described in ROADMAP.md's story section need
building (they're written up narratively but none of the four has map data yet).
