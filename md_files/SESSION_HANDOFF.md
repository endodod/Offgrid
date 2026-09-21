# Session handoff

Working notes so the next session can pick up exactly where this one left off. Delete or fold this into
ROADMAP.md once it's stale - it's a handoff note, not permanent documentation. See CLAUDE.md for when to
update this file.

## Milestone: 0a-0f and features 1-6 all done

Every feature through **6** in `md_files/ROADMAP.md`'s suggested order is committed and has its own
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
8. **Feature 6**: base building (`data/base.ts`, `core/base.ts`, `ui/base.ts`). Three facilities
   (medstation/workbench/commsRelay, 3 tiers each) spend `CampaignState.currency` and grant meta-progression
   bonuses (extra medkits/gadget uses, a player-only reserve-ammo multiplier) applied to every mission
   launched from the campaign screen, via `ui/campaign.ts`'s `applyBase`. No persistent-injury/roster system
   exists yet, so the medstation grants a resupply bonus rather than "healing between missions" - see the
   ROADMAP section's Resolved for why.

All verified with `npx vitest run` (247 tests passing as of the feature-6 commit) and a driven headless
browser for the full base-building flow (bank currency via supply runs -> spend it on the base screen ->
currency stays consistent across screens with no reload -> the bonus actually shows up on a unit card in a
real mission), with no console errors throughout.

## Nothing uncommitted right now

Working tree should be clean (`git status --short` empty) as of the feature-6 commit. If it isn't, something
changed after this note was written and wasn't captured here - check `git status`/`git diff` directly.

## Still worth knowing

- **AI doesn't plan around allies** and **AI doesn't open doors** (0c/2's own known scope lines).
- **Objective types are all player-only for v1** (3), and **no ammo loot-on-death or ally hand-over yet** (4).
- **Every campaign mission (story and generated) still uses Training Grounds' own map layout as a
  placeholder** (5) - the single biggest remaining content gap. Swapping in real per-district maps is a pure
  data change (`StoryMissionDef.map` / the supply-run generator's map constant), not an engineering task -
  `core/campaign.ts`/`ui/campaign.ts` are already fully generic over whatever `MapDef` a mission points to.
- **No persistent squad/roster between missions** (5/6's shared scope line): every mission, campaign or not,
  spawns the same fixed unit list from its own `MapDef.spawns`. There's no "the same five units, carrying
  HP/injuries/loot, across missions" concept. This is what #7 (equipment) and #8 (leveling) will need to
  introduce - base building deliberately worked around the gap rather than solving it, since solving it
  properly belongs with the features that actually need per-unit persistent identity.
- **Base facility bonuses only apply to campaign-launched missions**, not the standalone "Enter mission"
  Training Grounds entry on the home screen - that entry point stays the unmodified rules-sandbox (0f's own
  resolved decision), deliberately untouched by any meta-progression.
- **`ui/hud.ts`'s medkit/gadget-uses display no longer shows a `/max` denominator** (fixed this session) -
  neither value has a real fixed cap (pickups from #4 could already exceed the old flat-constant denominator;
  base bonuses from #6 make it common), so both now just show the current count.

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
end without playing out combat, useful for testing anything downstream of a win (campaign/base progression).

**Gotchas hit so far:**
- When clicking a sequence of canvas tiles in a script, don't cache the canvas's `boundingBox()` once up
  front - re-query it before each click, since layout can reflow between clicks.
- The page has *two* `<canvas>` elements (`#board`, `#bcanvas`) - a bare `page.locator('canvas')` throws a
  strict-mode violation.
- `locator.count() > 0` is true for a hidden element too - check `isVisible()` before conditionally clicking
  something like `#tutorial-skip` that may not have started.
- The home screen's mission-launch button is labeled "Enter mission", not "Start".

## What's next: feature 7 (unit equipment screen)

Per `md_files/ROADMAP.md`'s suggested order, everything through **6** is done. Next up:

**7. Unit equipment screen** (read ROADMAP.md's `## 7.` section for the full design sketch and open questions
before starting) - armor + 2 equipment slots, a loot system fed by chests (2's interactables) and enemy
drops. This is very likely the feature that finally needs a persistent per-unit roster (see "Still worth
knowing" above) - equipment has to live on *something* that survives between missions, which neither feature
5 nor 6 needed to build. Worth deciding that roster's shape carefully since #8 (leveling) will need the same
thing right after.

Then **8. Unit leveling & perks** (pairs with 7), then **9. Visual rehaul** (deliberately last).

**Also still pending:** real per-district `MapDef`s for the four Act 1 story missions (a content-authoring
task, not gated on any remaining engineering feature - see "Still worth knowing" above).
