# Session handoff

See CLAUDE.md for when to update this file.

## What's uncommitted in the working tree right now

One fix, from simulating a full game loop end-to-end (home -> campaign -> briefing -> mission -> auto-run ->
banner -> base) with a driven headless browser and cross-checking against `session.test.ts`:

- **`src/ui/session.ts`, `src/ui/session.test.ts`: a real soft-lock in auto-run (0d).** `aiTurn` (`core/ai.ts`)
  always submits its own `{type:'endTurn'}` as the last action of a team's turn (both teams, always has -
  that's how the enemy's own turn-ending has always worked). `Session.runPlayerAuto()`'s completion handler
  didn't know that: it called the full `Session.endTurn()` again once the auto-played player-phase generator
  reported done, and since `validate()` never checks whose phase it already is for `endTurn`, that flipped the
  phase a **second** time. Normally this just wastes a phase every round (turns burn ~3x too fast, the enemy's
  real turn is intermittently skipped) - reproduced live and confirmed by the new `session.test.ts` regression
  tests. Worse, when a casualty stops auto-run mid-phase (`autoRun` set to `false` before the redundant call),
  the redundant call is the *only* thing that ever starts the enemy's own phase - suppressing it left the game
  parked at `phase: 'enemy'` forever with `busy: false` (looks idle, "Your turn." shown), soft-locking the
  mission. Found by toggling auto-run on a real story mission (Riverside/Lights Out) in a driven Chromium
  session and watching it hang at "Turn 16 ENEMY PHASE" for 60+ seconds with no state change.
  - Fix: extracted the "run the enemy's stepped AI phase" half of `endTurn()` into `runEnemyPhase()`
    (precondition: it's already the enemy's phase), and `runPlayerAuto()`'s completion now calls that directly
    instead of re-deriving the phase transition through `endTurn()`. The enemy phase always runs once the
    player's phase (manual or auto) is over, regardless of `autoRun` - `autoRun` only decides whether
    `finishEnemyPhase()` loops back into another auto player-phase afterward, which is where it already
    correctly hands control back to the player.
  - Two new tests in `describe('auto-run phase chaining (0d regression)')` in `src/ui/session.test.ts`, using
    `vi.useFakeTimers()` (this codebase's first use of fake timers - everything else auto-run-shaped up to now
    was verified live in a browser only, per the prior handoff/ROADMAP notes, which is exactly how this slipped
    through). Both fail against the pre-fix code (verified via `git stash` on just `session.ts`) and pass after
    it. `npm test`: 480/480 pass (478 prior + 2 new). `tsc --noEmit` clean.
  - Not yet committed. Everything else in the tree is clean/matches HEAD (`d2dde33`).

## What else this session covered (no code changes needed)

- **Full game-loop tour**, driven headlessly (Playwright + a real Chromium, via the npx-cached install noted
  below) rather than read from code: home, lore, settings, campaign (district-intro modal, story/supply
  cards), briefing, a full mission played out by auto-run to a real "MISSION COMPLETE" banner with results
  table, base (all 5 tabs), loadout/equip, and the Training Grounds tutorial start screen. No other functional
  or visual bugs found - the UI is in the polished state ROADMAP.md's feature 10-19 status lines claim.
- **Security review** (this is a fully static, offline, single-player app - no server, no accounts, no network
  calls anywhere in `src/`/`scripts/`): no `eval`/`new Function`; no free-text input fields anywhere in the UI
  (only number/range/checkbox); the one place untrusted-shaped data enters (the debug map builder's JSON
  import, `ui/mapStore.ts` -> `core/mapFormat.ts`'s `parseMap`) is strict allow-list validation that never
  carries an arbitrary string from the JSON into a rendered template (tile chars, unit classes and AI profiles
  are all checked against fixed enums; there's no `name`/text field it passes through) - so the "sharing"
  workflow the README describes doesn't open a stored-XSS path the way it easily could have. Every
  `localStorage` read (`mapStore.ts`, `missionStore.ts`, `campaignStore.ts`, `prefs.ts`, `keybindings.ts`) is
  try/catch-guarded with a safe fallback, so a corrupted or hand-edited save can't brick the app, only reset
  that one slot. `npm audit`: 0 vulnerabilities, and the app ships zero runtime dependencies (only
  `devDependencies` - vite/vitest/tsx/typescript - none of which reach the built bundle). Nothing rose to the
  level of a finding.
- **Missing content/features**, reading straight off ROADMAP.md's own status lines (ground truth, not stale):
  every numbered feature 0a-8 and 10-19 is done; the two gaps are **feature 9 (visual rehaul)** -
  `render/renderer.ts` is still `ctx.fillRect` primitives for every unit/tile/door/pickup, by original design,
  never revisited - and **Act 2 and Act 3 missions** (`md_files/STORY.md` §3, §6): Act 1 (Riverside + Market
  Row, 10 missions) is fully built, but Dockyards/Substation Hill/Old Town (Act 2, 5 missions each, Cinder
  Wardens) and Uptown/The Grid (Act 3, Halcyon Systems, "not yet designed") have zero missions - the districts,
  briefings and unlock mechanism exist and wait on content only. Multiplayer (PvP/co-op) is unplanned past the
  design notes at the bottom of ROADMAP.md. This matches what the previous handoff already flagged as next up
  (see below) - it hasn't moved since, so Act 2 is still the biggest single gap.

## Next up

Unchanged from before this session (still accurate against ROADMAP.md):

1. **Act 2 missions** (Dockyards, Substation Hill, Old Town; five each). `md_files/STORY.md` §6 has the rules
   (map size, two-wide gaps) and Act 2's beats. Tools: `npm run map -- <NAME>` to preview, `npm run sim -- --map
   <id> --objective player --player-profile friendly` per mission, `npm run campaign-sim` for the act as a
   whole. Add each new map to `scripts/sim.ts`'s `MAPS` and `src/data/maps/index.ts`.
2. **A human playtest of Act 1,** especially the Clinic (57% in the sim; see ROADMAP 19).
3. **Feature 9, the visual rehaul.**

## Gotchas worth keeping (still true, carried forward)

- **The renderer draws in logical units through `ctx.setTransform(RES, ...)`.** Anything converting mouse or
  scroll positions must use the map's width in tiles (`ui/input.ts`, `Viewport.cssPerLogical`), never
  `canvas.width / TILE`.
- **`Session.onChange` fires on every hover.** Don't do real work in it unless something actually changed.
- **Bumping `SAVE_VERSION` in `core/save.ts`** is how to change `GameState`/`Unit` shape safely; older
  mid-mission saves are then ignored instead of half-read.
- **Headless browser driving on this (Windows) machine:** Playwright + a matching Chromium are already
  present, just not on PATH - `chromium-cli` isn't installed. Found a working pair this session:
  `%LOCALAPPDATA%\npm-cache\_npx\ac56acf9ae97d38a\node_modules\playwright` (v1.48.2) with
  `%LOCALAPPDATA%\ms-playwright\chromium-1243\chrome-win64\chrome.exe` (needs `executablePath` set explicitly -
  the default `chromium.launch()` looks for an older bundled revision that isn't there). Import it via
  `createRequire(import.meta.url)` in an `.mjs` driver script (a bare `import` of a `C:\...` path throws
  `ERR_UNSUPPORTED_ESM_URL_SCHEME`). `window.session` is the live `Session` for state introspection
  (`.state.turn`, `.state.phase`, `.busy`, `.autoRun`, `.log`) - far more reliable than scraping rendered text.
  `.env.local` already sets `VITE_DEBUG=true`. Run `npx vite --port 5199` in the background.
- **`vi.useFakeTimers()` works fine against `Session`'s `setTimeout`-chained playback** (this session's fix is
  the first test to do it) - `vi.advanceTimersByTimeAsync(ms)` in a polling loop, capped by an iteration count,
  is the pattern; a bare `vi.runAllTimers()` never terminates for anything auto-run-shaped since the loop only
  stops on a winner or a manual `toggleAutoRun()`.
- **Enemy counts must sit near parity with the player's five; high cover goes in lines, never slabs** (both
  from the Act 1 rework - see ROADMAP 19's own notes for the numbers behind these two).
- **`npm run sim -- --map <id>` defaults to the map's own shipped enemy profile**, not `standard`; pass
  `--objective player` for `hold` missions.
- **The bash tool in this environment truncates long heredocs.** Write scripts to the scratchpad with the
  Write tool and run them by path instead of piping a heredoc.
