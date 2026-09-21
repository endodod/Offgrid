# Session handoff

Working notes so the next session can pick up exactly where this one left off. Delete or fold this into
ROADMAP.md once it's stale - it's a handoff note, not permanent documentation. See CLAUDE.md for when to
update this file.

## Milestone: 0a-0f and features 1-4 all done

Every feature through **4** in `md_files/ROADMAP.md`'s suggested order is committed and has its own
**Status: done** section there (design notes, resolved open questions, what was deliberately deferred - read
those before re-deriving anything):

1. Story + Act 1 missions written into ROADMAP.md (Ashport, the Blackout, the Lamplighters, four Riverside
   missions - narrative only, no map data yet, see below).
2. **Feature 1**: weather/time-of-day.
3. **Feature 0a-0f**: hover/tooltip UI, revive, enemy AI habitat/difficulty profiles (+ per-unit override and
   map-builder support), friendly AI/auto-run, rebindable hotkeys, guided tutorial for Training Grounds
   (map/spawns reworked afterward so it's actually completable; no unit is pre-selected at mission start).
4. **Feature 2**: doors and switches. Closed doors block movement/LOS via `core/grid.ts`'s `closedDoorAt`;
   the generalized `interact` action opens them; a switch toggles its linked doors. AI treats closed doors
   as obstacles but doesn't open them (v1 scope). Map builder has door/switch placement + a link tool.
5. **Feature 3**: objective types (`data/objectives.ts`, `core/objectives.ts`). Four types - `hold`
   (the original behavior), `eliminateTarget`, `sabotage`, `reach` - on `MapDef.objective`. Training Grounds
   is unaffected (still the legacy hold default). `defend`/`escort`/`retrieve`/`survive` deferred - each
   needs a building block this codebase doesn't have yet.
6. **Feature 4**: consumables and an ammo economy (`core/pickups.test.ts`). `Unit.reserve` (per-class,
   `data/units.ts`) is what `reload` now draws from - empty reserve means no more reloading. Ammo/medkit/
   gadget pickups (`data/items.ts`, `MapDef.pickups`) are collected free by walking onto their tile, fog-fair
   via current visibility only (no remembered state, unlike doors). The AI reloads only with reserve left and
   seeks a visible ammo pickup when genuinely dry. `MapDef.reserveMult` / `--reserve-mult` (sim) scale
   scarcity per mission. This also resolves feature 3's `retrieve` gap partway (pickups exist now, but no
   "carry to extraction" objective type has been built on top of them yet).

All verified with `npx vitest run` (228 tests passing as of the feature-4 commit), `npm run sim` for the
ammo-economy balance numbers, and a driven headless browser for UI-touching pieces (workflow below).

## Nothing uncommitted right now

Working tree should be clean (`git status --short` empty) as of the feature-4 commit. If it isn't, something
changed after this note was written and wasn't captured here - check `git status`/`git diff` directly.

## Still worth knowing

- **AI doesn't plan around allies**: units can still jam each other at a genuine single-doorway chokepoint
  (`core/ai.ts` has no allied-coordination logic). Not currently triggered by Training Grounds' reworked
  layout, but could resurface on a tighter map (e.g. a future campaign mission).
- **AI doesn't open doors** (feature 2's own deliberate v1 scope line, not a bug): a closed door is just an
  obstacle to `core/ai.ts`; it will never plan a route that opens one.
- **Objective types are all player-only for v1** (feature 3): `eliminateTarget`/`sabotage`/`reach` have no
  per-team ownership field. `hold` keeps its existing `RULES.objectiveCapture` knob, unaffected.
- **No mission uses the three new objective types, or any pickups, yet**: Training Grounds stays its
  original hold-type, pickup-free self. Both are exercised only by their own hand-built test maps until
  #5's campaign layer ships a mission that actually uses them.
- **Ammo economy has no loot-on-death or ally-hand-over yet** (feature 4's own deliberate v1 scope line):
  killing an enemy doesn't drop anything, and there's no action to pass ammo between adjacent allies. Both
  are natural extensions of the same pickup/reserve machinery, deferred until #7 wants a reward loop to feed.

## How to verify UI changes (workflow used throughout)

No `chromium-cli` in this environment. The working pattern:
```
npm install --no-save playwright   # local-only, doesn't touch package.json/package-lock.json
(npm run dev > /tmp/vite.log 2>&1 &)
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
# write a scratch .mjs script under the repo root (not the scratchpad dir - node_modules resolution
# needs it there) using `import { chromium } from 'playwright'`, launch, page.goto, drive it,
# page.screenshot(...), read the screenshot with the Read tool
node scratch_whatever.mjs
```
Afterward: delete the scratch `.mjs`/`.png` files, kill the dev server (find the PID via
`netstat -ano | grep 5173` - watch for a non-English "LISTENING" string like `ABHÖREN` on a localized
Windows install - then `taskkill //PID <pid> //F`; `lsof` isn't available in this Git Bash), and
`npm uninstall playwright` to restore `node_modules` to match the committed lockfile. `.env.local` already
has `VITE_DEBUG=true` so the debug panel (`window.session` in the console, fog toggle, time/weather/enemy-AI
selectors, and the map builder itself) is available for setting up test scenarios without playing a full
mission by hand.

**Gotchas hit so far:**
- When clicking a sequence of canvas tiles in a script, don't cache the canvas's `boundingBox()` once up
  front - a status message elsewhere on the page (e.g. the builder's `#b-msg`) can reflow the layout and
  shift the canvas between clicks. Re-query `boundingBox()` before each click instead.
- The page has *two* `<canvas>` elements (`#board`, the play canvas, and `#bcanvas`, the debug map
  builder's) - a bare `page.locator('canvas')` throws a strict-mode violation. Target `#board` or `#bcanvas`
  explicitly.
- The home screen's mission-launch button is labeled "Enter mission", not "Start".
- The builder's tool buttons are plain `<button>`s inside `#b-tools`, addressable by their visible label
  text (`#b-tools button:has-text("Ammo pickup")`) - no need to know internal `data-tool` values.

## What's next: feature 5 (campaign map & mission generation)

Per `md_files/ROADMAP.md`'s suggested order, everything through **4** (the single-mission vocabulary layer)
is done. Next up is the meta-game layer, which needs at least a minimal second mission and a persistent save
file to test end-to-end - the first feature in this project that can't be fully proven against Training
Grounds alone:

**5. Campaign map & mission generation** (read ROADMAP.md's `## 5.` section for the full design sketch and
open questions before starting) - `data/campaign.ts`, a `CampaignState`, mission pool generation from the
seeded RNG, a new `ui/campaign.ts` screen. This is also the natural place to finally give the four Act 1
story missions real map data (see below), and to author the first mission that actually uses one of feature
3's non-hold objective types or feature 4's pickups for real, rather than only in hand-built tests.

Then **6. Base building**, **7. Unit equipment screen** (needs 2 and 4 for chests/drops, 6 for buying/
crafting), **8. Unit leveling & perks**, then **9. Visual rehaul** (deliberately last - presentation over
everything else on the list).

**Also still pending, not gated on anything above:** the four Act 1 story missions described in ROADMAP.md's
story section have narrative text (blurb, objective, beat) but **no map data yet** - they reuse Training
Grounds' tileset/palette conventions per that section's own open question, but each needs an actual `MapDef`
(rows/spawns/searchPoints, `interactables`, `pickups`, and now potentially a non-default `objective`)
authored. The map builder can place interactables and pickups directly, but **cannot** author `MapDef.objective`
or `MapDef.reserveMult` (both are hand-written TS metadata, same tier as `enemyProfile`/`startWeather`) - a
non-hold Act 1 mission's objective will need to be set directly in its map literal.
