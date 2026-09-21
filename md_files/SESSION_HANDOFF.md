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

**Follow-up after 0f, requested directly:** Training Grounds' map/spawns/objective were reworked so the
guided tutorial is actually completable without a long fog-blind search - player squad now clusters
bottom-left, one enemy sniper (weakest class) starts close by and already mutually visible at turn 1, the
objective moved from a walled courtyard to an open central tile at (12,7). `Session.reset()` also no longer
pre-selects a unit at mission start (the player's first click, including the tutorial's "select" step, is
now a deliberate one). See `ASSUMPTIONS.md`'s "Map and missions" section for the current layout and its
tradeoffs (it's now heavily player-favoured, ~99%+ sim win rate - appropriate for onboarding, worth knowing
if this map gets reused to balance-test something else later).

## Nothing uncommitted right now

Working tree should be clean (`git status --short` empty) as of the Training Grounds rework commit
(immediately after 0f). If it isn't, something changed after this note was written and wasn't captured here
- check `git status`/`git diff` directly.

## Resolved: the old Training Grounds chokepoint-jamming issue

Previously documented here as a known pre-existing issue: the old objective sat in a walled courtyard right
next to the enemy spawns, so `--objective player|both` was a near-instant enemy win and 5-unit squads could
jam each other at the courtyard's single doorway badly enough that elimination mode (`--objective none`)
never reached combat range at all. The map rework above incidentally fixed this - relocating the objective
away from a single-doorway room and re-spreading the spawns means both sim modes now resolve through real
combat 100% of the time (verified via `npm run sim`). Recorded here so it isn't rediscovered as broken.

**Still worth knowing:** the *underlying* AI limitation this exposed - units block movement and `core/ai.ts`
doesn't plan around allies, so it can still jam itself at a genuine single-doorway chokepoint - was never
fixed, only no longer triggered by Training Grounds' current layout. It could resurface on a future map (the
campaign's Act 1 missions, once they get map data) with a tighter doorway or a larger squad. If it does, a
small hand-built skirmish `MapDef` (both squads placed within ~5-6 tiles of each other on an open
`blank(w,h)` map) isolates AI/combat questions cleanly from any given map's own layout quirks - useful
generally, not just for this specific issue.

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

**No longer an issue, but worth knowing it used to be one:** `Session.reset()` used to auto-select the first
player unit at mission start, which made "click the first player unit" scratch-script steps accidentally
*deselect* it instead of selecting something new. As of the Training Grounds rework above, no unit is
pre-selected at mission start at all (`selectedId` starts `null`), so this trap is gone - any first click on
a unit is now a genuine new selection.

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
