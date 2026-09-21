# Session handoff

Working notes so the next session can pick up exactly where this one left off. Delete or fold this into
ROADMAP.md once it's stale - it's a handoff note, not permanent documentation. See CLAUDE.md for when to
update this file.

## Milestone: 0a-0f and features 1-5 all done

Every feature through **5** in `md_files/ROADMAP.md`'s suggested order is committed and has its own
**Status: done** section there (design notes, resolved open questions, what was deliberately deferred - read
those before re-deriving anything):

1. Story + Act 1 missions written into ROADMAP.md (Ashport, the Blackout, the Lamplighters, four Riverside
   missions - narrative only; map data is now a placeholder, not missing, see below).
2. **Feature 1**: weather/time-of-day.
3. **Feature 0a-0f**: hover/tooltip UI, revive, enemy AI habitat/difficulty profiles, friendly AI/auto-run,
   rebindable hotkeys, guided tutorial for Training Grounds.
4. **Feature 2**: doors and switches.
5. **Feature 3**: objective types (`hold`, `eliminateTarget`, `sabotage`, `reach` on `MapDef.objective`).
6. **Feature 4**: consumables and an ammo economy (`Unit.reserve`, ammo/medkit/gadget pickups).
7. **Feature 5**: campaign map & mission generation (`data/campaign.ts`, `core/campaign.ts`, `ui/campaign.ts`,
   `ui/campaignStore.ts`). A `Campaign` screen (reached via a "Campaign" button on the home screen) lists
   district progress, Act 1's four handcrafted story missions, and a rotating pool of 3 generated "supply
   run" missions whose difficulty escalates with completions. Persists to `localStorage`. **All campaign
   missions - story and generated - currently play on Training Grounds' own layout as a placeholder map**;
   the campaign *system* (generation, progression, persistence, UI, difficulty application) is fully built
   and tested, but no real per-district maps exist yet - see below.

All verified with `npx vitest run` (238 tests passing as of the feature-5 commit) and a driven headless
browser for the full campaign flow (enter screen -> play and win a story mission -> returns to campaign, not
home -> play and win a supply run -> currency/pool update correctly), with no console errors throughout.

## Nothing uncommitted right now

Working tree should be clean (`git status --short` empty) as of the feature-5 commit. If it isn't, something
changed after this note was written and wasn't captured here - check `git status`/`git diff` directly.

## Still worth knowing

- **AI doesn't plan around allies** and **AI doesn't open doors** (features 0c/2's own known scope lines,
  not bugs) - see their own ROADMAP.md sections for detail.
- **Objective types are all player-only for v1** (feature 3), and **no ammo loot-on-death or ally hand-over
  yet** (feature 4) - both deliberate v1 scope lines, see their own Resolved sections.
- **The single biggest content gap right now: every campaign mission uses Training Grounds' map layout.**
  `data/campaign.ts`'s `STORY_MISSIONS` and the supply-run generator both point at `TRAINING_GROUNDS` as a
  placeholder `MapDef`. Swapping in real maps is a pure data change (author a new `MapDef` per story mission,
  point `StoryMissionDef.map` at it) - it does **not** require touching `core/campaign.ts` or `ui/campaign.ts`
  at all, since both are already fully generic over whatever `MapDef` a mission points to. The map builder
  can author the rows/spawns/interactables/pickups directly; a non-hold `objective` or a non-default
  `reserveMult` still has to be hand-written in the map's own TS literal (features 3/4's own scope lines).
- **Campaign currency is tracked and saved but unspendable** (feature 5's own scope line) - `CampaignState.currency`
  banks correctly from supply-run rewards; #6 (base building) is what gives it a purpose.
- **No squad persistence between missions yet**: every mission (campaign or not) still spawns the same fixed
  roster from its `MapDef.spawns` - there's no concept of "the same five units, carrying HP/injuries/loot,
  across missions." That's a #6/#7 concern, not something feature 5 attempted.

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
mission by hand - `window.session.state.winner = 'player'; window.session.onChange();` is a quick way to
force a mission to end in the browser without actually playing out combat, useful for testing anything
downstream of a win (like campaign progression).

**Gotchas hit so far:**
- When clicking a sequence of canvas tiles in a script, don't cache the canvas's `boundingBox()` once up
  front - a status message elsewhere on the page can reflow the layout and shift the canvas between clicks.
  Re-query `boundingBox()` before each click instead.
- The page has *two* `<canvas>` elements (`#board`, the play canvas, and `#bcanvas`, the debug map
  builder's) - a bare `page.locator('canvas')` throws a strict-mode violation.
- `locator.count() > 0` is true for a hidden element too (it's still in the DOM) - a script that only checks
  `count()` before clicking something conditionally-hidden (like `#tutorial-skip` when the tutorial hasn't
  started) will hang retrying a click on an invisible element. Check `isVisible()` instead.
- The home screen's mission-launch button is labeled "Enter mission", not "Start".

## What's next: feature 6 (base building)

Per `md_files/ROADMAP.md`'s suggested order, everything through **5** is done. Next up:

**6. Base building** (read ROADMAP.md's `## 6.` section for the full design sketch and open questions before
starting) - `data/base.ts`, a `BaseState`, a new `ui/base.ts` screen, facility build/upgrade logic. This is
the first thing that can actually spend feature 5's `CampaignState.currency`, so wiring that spend is a
natural integration point to build alongside it.

Then **7. Unit equipment screen** (needs 2 and 4 for chests/drops, 6 for buying/crafting), **8. Unit leveling
& perks**, then **9. Visual rehaul** (deliberately last).

**Also still pending:** real per-district `MapDef`s for the four Act 1 story missions (see "Still worth
knowing" above) - a content-authoring task, not gated on any remaining engineering feature. Worth doing
whenever there's appetite for level-design work specifically, independent of 6-9's own order.
