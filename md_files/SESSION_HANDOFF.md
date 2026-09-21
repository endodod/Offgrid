# Session handoff

Working notes so the next session can pick up exactly where this one left off. Delete or fold this into
ROADMAP.md once it's stale - it's a handoff note, not permanent documentation. See CLAUDE.md for when to
update this file.

## What's committed so far (this multi-session effort, in order)

1. **Story + Act 1 missions** added to ROADMAP.md (Ashport, the Blackout, the Lamplighters, four Riverside
   missions), plus **Feature 1: weather/time-of-day**, plus fixes for two pre-existing test failures and a
   stale ASSUMPTIONS.md left by the map-change commit before this effort started.
2. **Feature 0a**: hover/tooltip UI clarity pass.
3. **Feature 0b**: revive mechanic (downed state, bleed-out, the revive action, finishing shots, AI
   revive/finish behaviour).
4. **Feature 0c**: enemy AI habitat + difficulty profiles (`data/aiProfiles.ts`, per-team
   `GameState.aiProfiles`; `standard` is a byte-for-byte regression-safe default), later extended with a
   **per-unit profile override** (`Spawn`'s optional 4th element) and map-builder support for it (an "Enemy
   AI" dropdown, shown only for the enemy-unit tool).
5. **Feature 0d**: friendly AI + auto-run. A `friendly` profile (`prioritizeObjective`, a higher
   `retreatBelowHp` than `hard`) plus `Session.autoRun`/`toggleAutoRun()`/`runPlayerAuto()` in
   `ui/session.ts` (key `P`, HUD button `#auto-run-toggle`), mirroring the existing enemy-phase stepped-loop
   pattern. Hands control back automatically on a player casualty; chains phase after phase until the
   mission ends or the player toggles it off.
6. **Feature 0e**: rebindable hotkey settings. `ui/keybindings.ts` (new) + `ui/input.ts` (now owns the live
   `KeyBindings`, `bindInput` dispatches by lookup instead of a hard-coded map) + `ui/settings.ts` (new
   screen, reachable from home and the in-game topbar). `ui/hud.ts`'s action bar/tooltips read the live
   binding instead of a hard-coded key label. One deliberate behaviour change: `Enter` no longer also ends
   the turn alongside `E` (the old map's hidden second binding for one action doesn't fit "one key per
   action, settings screen shows the whole truth" - rebind it back if you want it).

Each of these has its own **Status: done** section in `md_files/ROADMAP.md` with full design notes,
resolved open questions, and what was deliberately deferred - read those before re-deriving anything. All
were verified with `npx vitest run` and, for UI-touching ones, a driven headless browser (see below) before
committing. 168 tests passing as of the 0e commit.

## Nothing uncommitted right now

Working tree should be clean (`git status --short` empty) as of the 0d commit. If it isn't, something
changed after this note was written and wasn't captured here - check `git status`/`git diff` directly.

## Known pre-existing issue (not caused by this effort, already documented)

Training Grounds' enemy squad spawns right next to the objective courtyard's single doorway. With 5-unit
squads, AI units can jam each other there and never reach combat range in elimination mode (`--objective
none`), and `--objective player|both` is a near-instant, near-deterministic enemy win by capture instead of
a balanced test. Flagged in `ASSUMPTIONS.md` and `ROADMAP.md`'s #0c section already. When sanity-checking
anything with `npm run sim` or a scratch script, use a small hand-built skirmish `MapDef` (both squads
placed within ~5-6 tiles of each other on an open `blank(w,h)` map) instead of `TRAINING_GROUNDS`, or you'll
see nothing but draws/timeouts and wrongly conclude a feature doesn't work.

## How to verify UI changes (workflow used throughout)

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

## What's next: 0f

Per `md_files/ROADMAP.md`'s suggested order, 0a-0e are all done. Next up:

**0f. Tutorial** (medium) - depends on 0a (reuses hover/tooltip) and benefits from 0b-0e existing first so
it can cover them too - all now in place. Read ROADMAP.md's #0f section for the full design sketch and open
questions before starting.

After 0f, the roadmap moves to feature 1 (already done, out of order - it landed before this effort's 0a-0d
work), then 2 (doors), 3 (objective types), 4 (consumables/ammo economy), then the meta-game layer 5-8.
The actual Act 1 mission maps described in ROADMAP.md's story section still need building - they're written
up narratively but none of the four has map data yet.
