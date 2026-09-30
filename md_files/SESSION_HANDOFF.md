# Session handoff

See CLAUDE.md for when to update this file. Everything from the last session is committed and pushed
(branch `claude/great-pascal-55oxtu`) and written up in ROADMAP.md #20-#24 and STORY.md §4-§9; this file is
trimmed to what's next and the gotchas worth keeping.

## Last session, in one line each

- `b317bc7` engine: survive / defend / retrieve / eliminateTargets, sentry + drone, story missions in order, sim uses map conditions
- `80b71a9`, `bc7ab40` Act 2 (15 missions) and its balance pass
- `21288b1`, `eb5f9ee` Act 3 (10 missions); the campaign is complete at 35 story missions
- `c1d39e7` epilogue, act-aware supply runs, dry units seek ammo
- `b0853b0` difficulty (Story / Standard / Veteran), act-seasoned recruits
- `c2f581f`, `58fdf9e` sprites, chooser layout, favicon, district rail; memorial and campaign record
- `a493119` mobile layout
- `2a200a7` versus (hotseat PvP)
- `e5932f3` an active hold reveals itself; Pumphouse on easy

Nothing is uncommitted.

## Next up

1. **A human playtest of Acts 2-3.** Every number in STORY.md §8-§9 is AI-vs-AI. The ones most worth a human
   look: **the Bell Tower** (3.5 soldiers lost per run - the sim's squad walks across the square under the
   sniper; a human should use the arcades, and if they can't, Brand needs a weaker spot), **the Cooling Plant**
   (86% sim draws - is the steam maze fun or just slow?), **Grid Control** (the finale, 3.4 lost at level 4).
2. **Feature 9, the visual rehaul** - still the only numbered feature left. Units are coloured squares with a
   letter; at Fit zoom on the big Act 2-3 maps they are small. Sentries and drones have their own shapes now,
   which is the pattern to follow.
3. **Online versus**, if wanted: the flip design (core/pvp.ts) carries over to lockstep, but it needs a relay
   server; nothing in this repo provides one.
4. **Campaign sim over three acts** never finishes (its AI draws long missions at the 40-turn cap and counts it
   as a loss). If it's to be useful for Acts 2-3, count a draw as a retreat-and-retry rather than a loss, or
   raise the cap for it.

## Gotchas worth keeping

- **`npm run sim` flags override the map.** Fixed so that omitted flags now defer to the map's own conditions -
  but any flag you pass (`--weather`, `--time-of-day`, `--reserve-mult`, `--pods`) still overrides it.
- **Use `defend`, not `camper`, for a guard or boss that must stay put.** A camper leaves its post whenever it
  has no shot.
- **Balance on "squad lost per match", not the win rate**, for survive and defend missions: they win nearly
  always and still cost soldiers.
- **Waypoints and reinforcement tiles can't sit on 'O' tiles** (maps.test.ts checks WALKABLE, and 'O' isn't).
- **Versus flips team labels** every turn. Anything new that keeps per-team state in `GameState` must be added
  to `flipTeams` in core/pvp.ts, or it will belong to the wrong side after the first turn.
- **The renderer draws in logical units through `ctx.setTransform(RES, ...)`.** Anything converting mouse or
  scroll positions must use the map's width in tiles (`ui/input.ts`, `Viewport.cssPerLogical`).
- **`Session.onChange` fires on every hover.** Don't do real work in it unless something changed.
- **Bumping `SAVE_VERSION` in `core/save.ts`** is how to change `GameState`/`Unit` shape safely.
- **Headless browser in the cloud container**: Playwright is global (`$(npm root -g)/playwright`), Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. `VITE_DEBUG=true` in `.env.local` exposes
  `window.session`. Phone checks: viewport 390x844 and compare `document.documentElement.scrollWidth`.
- **`vi.useFakeTimers()` works against Session's setTimeout-chained playback** (see session.test.ts).
