# Session handoff

Working notes so the next session can pick up exactly where this one left off. Delete or fold this into
ROADMAP.md once it's stale - it's a handoff note, not permanent documentation. See CLAUDE.md for when to
update this file.

## Milestone: 0a-0f all done

Every "go first" feature in `md_files/ROADMAP.md`'s suggested order is committed and has its own
**Status: done** section there (design notes, resolved open questions, what was deliberately deferred - read
those before re-deriving anything). In order:

1. Story + Act 1 missions written into ROADMAP.md (Ashport, the Blackout, the Lamplighters, four Riverside
   missions - narrative only, no map data yet, see below).
2. **Feature 1**: weather/time-of-day.
3. **Feature 0a**: hover/tooltip UI clarity pass.
4. **Feature 0b**: revive mechanic.
5. **Feature 0c**: enemy AI habitat + difficulty profiles, later extended with a per-unit override and
   map-builder support for it.
6. **Feature 0d**: friendly AI + auto-run.
7. **Feature 0e**: rebindable hotkey settings.
8. **Feature 0f**: guided tutorial for Training Grounds.

All verified with `npx vitest run` (178 tests passing as of the 0f commit) and, for UI-touching ones, a
driven headless browser before committing (see workflow below).

## Nothing uncommitted right now

Working tree should be clean (`git status --short` empty) as of the 0f commit. If it isn't, something
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

**A recurring test-script trap hit more than once this session:** Training Grounds auto-selects the first
player unit on mission load (`Session.reset()`). A scratch script that clicks "the first player unit" to
select it is actually *deselecting* the already-selected one. Pick a *different* unit (or check
`window.session.selectedId` first) when a script needs to exercise "select a new unit."

## What's next: feature 2 (doors and interactive map parts)

Per `md_files/ROADMAP.md`'s suggested order, everything before the numbered content features (2, 3, 4) is
done. Weather (1) already landed earlier alongside 0a. Next up:

**2. Doors and interactive map parts** (medium) - adds `interactables` to `MapDef` alongside `rows`/`spawns`
(doors, switches, terminals, destructible/upgradeable cover, explosive barrels), runtime state on
`GameState`, and generalizes the `interact` action from "the objective" to "an adjacent interactable, by
target". Touches `core/grid.ts`'s `blocksMove`/`blocksLos` (today purely terrain/cover-based), `core/vision.ts`
(fog/memory for door state), `core/ai.ts` (closed doors as obstacles at minimum), `core/mapFormat.ts` +
the map builder (new tools, a link tool for switch-to-door), and the renderer. Read ROADMAP.md's `## 2.`
section for the full design sketch and open questions (free vs action-cost to open, can units close doors,
noise/alerting) before starting.

Then **3. Objective types** (needs some of 2's interactables for "sabotage N terminals"), **4. Consumables
and ammo economy** (needs 3 for "retrieve" objectives), then the meta-game layer **5-8** (campaign map, base
building, equipment, leveling).

**Also still pending, not gated on anything above:** the four Act 1 story missions described in ROADMAP.md's
story section have narrative text (blurb, objective, beat) but **no map data yet** - they reuse Training
Grounds' tileset/palette conventions per that section's own open question, but each needs an actual `MapDef`
(rows/spawns/searchPoints) authored, most naturally via the debug map builder once there's a slot for
"campaign missions" in `data/missions.ts` or a future `data/campaign.ts` (feature 5).
