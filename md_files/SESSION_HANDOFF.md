# Session handoff

Working notes so the next session can pick up exactly where this one left off. Delete or fold this into
ROADMAP.md once it's stale - it's a handoff note, not permanent documentation. See CLAUDE.md for when to
update this file.

## Milestone: 0a-0f, feature 1 (weather), and feature 2 (doors/switches) all done

Every feature through **2** in `md_files/ROADMAP.md`'s suggested order is committed and has its own
**Status: done** section there (design notes, resolved open questions, what was deliberately deferred - read
those before re-deriving anything):

1. Story + Act 1 missions written into ROADMAP.md (Ashport, the Blackout, the Lamplighters, four Riverside
   missions - narrative only, no map data yet, see below).
2. **Feature 1**: weather/time-of-day.
3. **Feature 0a-0f**: hover/tooltip UI, revive, enemy AI habitat/difficulty profiles (+ per-unit override and
   map-builder support), friendly AI/auto-run, rebindable hotkeys, guided tutorial for Training Grounds
   (map/spawns reworked afterward so it's actually completable; no unit is pre-selected at mission start).
4. **Feature 2**: doors and switches (`core/interactables.test.ts`, `mapFormat.test.ts` additions). Closed
   doors block movement/LOS via `core/grid.ts`'s `closedDoorAt`; the generalized `interact` action opens
   them (1 action, triggers overwatch, remembered under fog); a switch toggles its linked doors. AI treats
   closed doors as obstacles but doesn't open them (v1 scope); grenades don't affect doors. Map builder has
   door/switch placement + a link tool; the in-game Interact button disambiguates between the objective and
   nearby doors/switches.

All verified with `npx vitest run` (192 tests passing as of the feature-2 commit) and, for UI-touching ones,
a driven headless browser before committing (workflow below).

## Nothing uncommitted right now

Working tree should be clean (`git status --short` empty) as of the feature-2 commit. If it isn't, something
changed after this note was written and wasn't captured here - check `git status`/`git diff` directly.

## Still worth knowing

- **AI doesn't plan around allies**: units can still jam each other at a genuine single-doorway chokepoint
  (`core/ai.ts` has no allied-coordination logic). Not currently triggered by Training Grounds' reworked
  layout, but could resurface on a tighter map (e.g. a future campaign mission). A hand-built skirmish
  `MapDef` (both squads within ~5-6 tiles on a `blank(w,h)` map) isolates AI/combat questions from any given
  map's layout quirks if this needs investigating again.
- **AI doesn't open doors** (feature 2's own deliberate v1 scope line, not a bug): a closed door is just an
  obstacle to `core/ai.ts`; it will never plan a route that opens one. Revisit if/when an AI-controlled squad
  or "friendly" auto-run units actually need to route through one.

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

**Gotcha hit this session:** when clicking a sequence of canvas tiles in a script, don't cache the canvas's
`boundingBox()` once up front - a status message elsewhere on the page (e.g. the builder's `#b-msg`) can
reflow the layout and shift the canvas between clicks, silently making later clicks land on the wrong tile.
Re-query `boundingBox()` before each click instead.

## What's next: feature 3 (different objective types)

Per `md_files/ROADMAP.md`'s suggested order, everything through **2** is done. Next up:

**3. Different objective types** (read ROADMAP.md's `## 3.` section for the full design sketch and open
questions before starting) - can lean on feature 2's `interactables` for e.g. "sabotage N terminals" style
objectives.

Then **4. Consumables and ammo economy** (needs 3 for "retrieve" objectives), then the meta-game layer
**5-8** (campaign map, base building, equipment, leveling), then **9. Visual rehaul** (deliberately last -
presentation over everything else on the list).

**Also still pending, not gated on anything above:** the four Act 1 story missions described in ROADMAP.md's
story section have narrative text (blurb, objective, beat) but **no map data yet** - they reuse Training
Grounds' tileset/palette conventions per that section's own open question, but each needs an actual `MapDef`
(rows/spawns/searchPoints, and now potentially `interactables`) authored, most naturally via the debug map
builder once there's a slot for "campaign missions" in `data/missions.ts` or a future `data/campaign.ts`
(feature 5).
