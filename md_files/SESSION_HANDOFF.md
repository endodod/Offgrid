# Session handoff

Working notes so the next session can pick up exactly where this one left off. Delete or fold this into
ROADMAP.md once it's stale - it's a handoff note, not permanent documentation. See CLAUDE.md for when to
update this file.

## Milestone: 0a-0f and features 1-8 all done - only feature 9 (visual rehaul) left in the numbered sequence

Every feature through **8** in `md_files/ROADMAP.md`'s suggested order is committed and has its own
**Status: done** section there (design notes, resolved open questions, what was deliberately deferred - read
those before re-deriving anything):

1. Story + Act 1 missions written into ROADMAP.md - narrative only; map data is a placeholder, not missing.
2. **Feature 1**: weather/time-of-day.
3. **Feature 0a-0f**: hover/tooltip UI, revive, enemy AI habitat/difficulty profiles, friendly AI/auto-run,
   rebindable hotkeys, guided tutorial for Training Grounds.
4. **Feature 2**: doors and switches.
5. **Feature 3**: objective types (`hold`, `eliminateTarget`, `sabotage`, `reach`).
6. **Feature 4**: consumables and an ammo economy (`Unit.reserve`, ammo/medkit/gadget pickups).
7. **Feature 5**: campaign map & mission generation (district progress, 4 handcrafted Act 1 story missions,
   a generated "supply run" pool). All campaign missions use Training Grounds' layout as a placeholder map.
8. **Feature 6**: base building (medstation/workbench/commsRelay facilities spending campaign currency).
9. **Feature 7**: unit equipment (armor + 2 equipment slots, loot-only acquisition via chests/enemy drops,
   persisted per class).
10. **Feature 8**: unit leveling & perks (`data/leveling.ts`, `data/perks.ts`, `core/leveling.ts`). Post-mission
    XP (not a live per-event stream - see the ROADMAP section's Resolved), a shared 5-level curve per class,
    20 perks (4/class) as flat stat modifiers folded into the same `effective*` functions #7 introduced,
    persisted per class in `CampaignState.levels`, assignable at the (extended, not new) Equip screen.
    Permadeath resets a class's level/XP/equipped loadout but keeps its unlocked perk pool.

All verified with `npx vitest run` (292 tests passing as of the feature-8 commit), `npm run sim
-- --player-level 5` showing a real, measurable balance shift, and a driven headless browser for the full
level-up -> equip-perk -> next-mission-applies loop, with no console errors throughout.

## Nothing uncommitted right now

Working tree should be clean (`git status --short` empty) as of the feature-8 commit. If it isn't, something
changed after this note was written and wasn't captured here - check `git status`/`git diff` directly.

## Still worth knowing

- **AI doesn't plan around allies**, **AI doesn't open doors** (0c/2), **objective types are player-only** (3),
  **no ammo loot-on-death** (4, though armor/equipment loot-on-death exists since 7) - see each feature's own
  ROADMAP.md Resolved section.
- **Every campaign mission still uses Training Grounds' own map layout as a placeholder** (5) - the single
  biggest remaining content gap, unrelated to any engineering feature landing. Still true after 6/7/8.
- **Still no persistent per-instance roster** - features 5, 6, 7 *and now 8* have all gotten away with
  tracking a squad by **class** (one soldier, one sniper, etc.) rather than by individually named, persisted
  unit instances, because Training Grounds' fixed one-of-each-class squad makes the two models
  observationally identical for every mission that exists today. This is worth treating as a settled
  decision, not a gap waiting to be closed - four features in a row didn't need it. It only becomes real work
  the moment some mission fields two units of the same class, which hasn't happened yet (and won't, until
  real per-district Act 1 maps are authored - see below).
- **A real bug found and fixed in feature 7, still relevant**: this codebase has *two* separate "a unit just
  died" code paths (`core/combat.ts`'s `finalizeDeath` and `core/state.ts`'s `tickBleedOut`). Any future
  "on enemy death" hook (loot, XP, achievements, whatever) needs to be wired into **both**, not just the
  more obviously-named `finalizeDeath`.
- **Perks and equipment bonuses stack uncapped** (8's own Resolved) - not yet a problem at Training-Grounds
  scale, flagged as something to watch once real content exists to stress-test combinations.
- **The "Equip" screen is now doing double duty** (gear from #7, levels/perks from #8) - deliberate, to avoid
  a fourth "manage my squad" screen alongside Campaign/Base. If it gets crowded once #9 gives it a real visual
  pass, splitting it back out is a UI-only change - neither feature's underlying data model assumes one shared
  screen.

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
mission by hand - `window.session.state.winner = 'player'; window.session.onChange();` forces a mission to
end without playing out combat; directly poking a unit's `dmgDealt`/`kills`/`armor`/`equipment` before
forcing the win is the fastest way to test campaign persistence without relying on RNG or actual combat.

**Gotchas hit so far:**
- **`page.on('dialog', d => d.accept())` is required before triggering anything that calls `confirm()`**
  (e.g. the map builder's "Back" button when there are unsaved changes) - Playwright auto-*dismisses* native
  dialogs by default, so an unhandled `confirm()` silently returns `false`/cancel with no error.
- When clicking a sequence of canvas tiles in a script, re-query the canvas's `boundingBox()` before each
  click - layout can reflow between clicks (e.g. a status message changing height).
- The page has *two* `<canvas>` elements (`#board`, `#bcanvas`) - a bare `page.locator('canvas')` throws a
  strict-mode violation.
- `locator.count() > 0` is true for a hidden element too - check `isVisible()` before conditionally clicking
  something like `#tutorial-skip` that may not have started.
- The home screen's mission-launch button is labeled "Enter mission", not "Start".

## What's next: feature 9 (visual rehaul) - the last item in the main numbered sequence

Per `md_files/ROADMAP.md`'s suggested order, everything through **8** is done. Feature 9 is deliberately last
("presentation over everything else on this list") and is a large, different *kind* of feature - real art for
units, items, tiles, base building, etc. - rather than new mechanics. Read ROADMAP.md's `## 9.` section in
full before starting; it's likely to need different tools/skills than the mechanical features 0-8 did (this
session had no image-generation or asset-pipeline tooling available - check what's available before
committing to an approach).

**Also still pending, not gated on 9:** real per-district `MapDef`s for the four Act 1 story missions (a
content-authoring task, flagged as pending since feature 5 and still true). Once real maps exist, that's also
when the "per-class not per-instance roster" simplification (see "Still worth knowing" above) may finally
need revisiting, if any of those maps field two units of the same class.

**After 9:** per ROADMAP.md's own closing section, multiplayer (PvP and co-op) is the next horizon beyond
this file's numbered list - nothing has been designed for it yet.
