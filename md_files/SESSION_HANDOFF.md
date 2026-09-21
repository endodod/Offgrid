# Session handoff

Working notes so the next session can pick up exactly where this one left off. Delete or fold this into
ROADMAP.md once it's stale - it's a handoff note, not permanent documentation. See CLAUDE.md for when to
update this file.

## Milestone: 0a-0f and features 1-7 all done

Every feature through **7** in `md_files/ROADMAP.md`'s suggested order is committed and has its own
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
8. **Feature 6**: base building (medstation/workbench/commsRelay facilities spending campaign currency for
   meta-progression bonuses on campaign-launched missions).
9. **Feature 7**: unit equipment (`data/armor.ts`, `data/equipment.ts`, `data/loot.ts`, `ui/equip.ts`). One
   armor slot (stacks on class base) + two equipment slots (each counters a specific weather/time-of-day
   penalty, or gives a flat move bonus) per unit. Acquired via loot only (chests - a new interactable type -
   and enemy deaths), persisted per **class** (not per named recruit - there's still no persistent roster,
   see below) in `CampaignState.loadouts`/`unlockedGear`, assignable at the new Equip screen. Buy/craft
   acquisition routes deferred - no base-screen reason to sell gear yet, no materials concept exists.

All verified with `npx vitest run` (267 tests passing as of the feature-7 commit), `npm run sim` as a smoke
check, and a driven headless browser for the full loot -> persist -> equip -> next-mission-applies loop
(confirmed a unit's unit card correctly showed its found gear's stat bonuses on a *fresh* mission with no
manual equip step), with no console errors throughout.

## Nothing uncommitted right now

Working tree should be clean (`git status --short` empty) as of the feature-7 commit. If it isn't, something
changed after this note was written and wasn't captured here - check `git status`/`git diff` directly.

## Still worth knowing

- **AI doesn't plan around allies** and **AI doesn't open doors** (0c/2's own known scope lines).
- **Objective types are all player-only for v1** (3), and **no ammo loot-on-death or ally hand-over yet** (4)
  - though enemy death now DOES drop armor/equipment loot (7), so "no loot on death" from #4's own Resolved
    section is now only true for ammo/medkits specifically, not gear.
- **Every campaign mission still uses Training Grounds' own map layout as a placeholder** (5) - the single
  biggest remaining content gap, unrelated to any engineering feature landing.
- **Still no persistent per-instance roster** (5/6/7's shared, repeatedly-flagged scope line): the campaign
  tracks a squad by *class* (one soldier, one sniper, etc.), not by individually named, persisted unit
  instances. Equipment loadouts persist per class for exactly this reason. **#8 (leveling) is very likely the
  feature that finally forces this** - individual XP/level state has nowhere to live under the current
  per-class model. Worth deciding the roster's real shape carefully when starting #8, since equipment would
  then migrate from per-class to per-instance too.
- **A real bug found and fixed this session, worth remembering the shape of**: this codebase has *two*
  separate "a unit just died" code paths - `core/combat.ts`'s `finalizeDeath` (a finishing shot) and
  `core/state.ts`'s `tickBleedOut` (bleeding out unrevived). Feature 7's loot-on-death hook was first added
  to only the former and silently never fired for the latter. Fixed via a shared `core/loot.ts`'s
  `lootOnDeath`, called from both. **Any future "on enemy death" hook needs to be wired into both paths**,
  not just `finalizeDeath` - it's the more obviously-named one but not the only one.
- **`data/loot.ts`'s table is armor/equipment only** - ammo/medkit/gadget pickups keep their own #4
  hand-authored placement system, deliberately not unified with loot.

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
end without playing out combat; directly poking `window.session.state.units[i].armor`/`.equipment` before
forcing the win is the fastest way to test loot persistence without relying on the RNG to drop the right item.

**Gotchas hit so far:**
- **`page.on('dialog', d => d.accept())` is required before triggering anything that calls `confirm()`**
  (e.g. the map builder's "Back" button when there are unsaved changes) - Playwright auto-*dismisses* native
  dialogs by default, so an unhandled `confirm()` silently returns `false`/cancel and the click that should
  have navigated away does nothing, with no error - just a button that looks like it didn't work.
- When clicking a sequence of canvas tiles in a script, don't cache the canvas's `boundingBox()` once up
  front - re-query it before each click, since layout can reflow between clicks.
- The page has *two* `<canvas>` elements (`#board`, `#bcanvas`) - a bare `page.locator('canvas')` throws a
  strict-mode violation.
- `locator.count() > 0` is true for a hidden element too - check `isVisible()` before conditionally clicking
  something like `#tutorial-skip` that may not have started.
- The home screen's mission-launch button is labeled "Enter mission", not "Start".

## What's next: feature 8 (unit leveling & perks)

Per `md_files/ROADMAP.md`'s suggested order, everything through **7** is done. Next up:

**8. Unit leveling & perks** (read ROADMAP.md's `## 8.` section for the full design sketch and open questions
before starting) - per-class paths, a growing perk pool and slots. This is very likely the feature that
finally needs a persistent per-*instance* roster (see "Still worth knowing" above) rather than the per-class
model 5/6/7 have all gotten away with so far - deciding that roster's shape is probably the first real design
decision of this feature, and equipment (7) would migrate onto it too once it exists.

Then **9. Visual rehaul** (deliberately last - presentation over everything else on the list). At that point
every numbered feature in the roadmap's main sequence is done.

**Also still pending:** real per-district `MapDef`s for the four Act 1 story missions (a content-authoring
task, not gated on any remaining engineering feature).
