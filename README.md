# Offgrid

A turn-based squad tactics game in a city three years off the grid. Vite + TypeScript + Canvas, no engine, no
server, no runtime dependencies.

- **Campaign**: 35 hand-authored story missions across three acts and seven districts, generated supply runs
  between them, a base to build, a roster with gear, levels and permadeath (or not - three difficulty levels),
  and an ending.
- **Versus**: hotseat PvP on one screen, three symmetric arenas.
- **Training Grounds**: a range with a guided tutorial.

Plays on desktop and on phones (touch, pinch zoom, a phone layout).

```
npm install
npm run dev        # play in the browser
npm test           # vitest (rules live in src/core)
npm run sim        # AI-vs-AI balance sim: npm run sim -- --map <mission-id> --objective player --player-profile friendly --player-level 3
npm run campaign-sim  # whole-campaign sim: npm run campaign-sim -- --acts 3 --difficulty standard
npm run map -- <MAP_CONST>   # print an authored map as annotated ASCII
npm run build
```

## Debug mode and map builder

Hidden by default. To turn it on locally, put `VITE_DEBUG=true` in `.env.local` (git-ignored; copy `.env.example`) and restart `npm run dev`. It enables:

- the debug panel in the game (fog toggle, reset map, reseed RNG, skip enemy phase) and `window.session` in the console;
- **Edit map (debug)** on the home screen: a map builder for the Training Grounds. Paint floor, walls, bushes, low cover (Q / wheel rotates it), high cover, the objective and unit spawns; right-drag erases. **Play test** runs the working map, **Save** stores it in the browser (localStorage) and it then replaces the default map for that mission, **Reset to default** deletes it. JSON import/export is there for sharing or pasting into `src/data/trainingGrounds.ts`.

Without the flag none of this is reachable, and a saved custom map is ignored.

## Layout

| Path | What |
|---|---|
| `src/data/` | All numbers: `units.ts`, `gadgets.ts`, `rules.ts`, `trainingGrounds.ts` (ASCII map), `missions.ts` (home screen list), `campaign.ts` (districts, story missions, supply-run templates) |
| `src/data/maps/story/` | The 35 story levels: one file per Act 1 map, one file per district from Act 2 on, composed with `maps/compose.ts` |
| `src/data/maps/supplyMaps.ts` | The layouts a generated supply run draws from |
| `src/data/maps/pvp.ts` | The mirror-symmetric versus arenas |
| `src/core/` | Pure rules: no DOM, no canvas, seeded RNG. `actions.ts` is the rule entry point (`validate` / `perform`) |
| `src/render/` | Canvas drawing (reads state only) |
| `src/ui/` | HUD, input, session (clicks -> core actions), home screen, map builder (debug) |
| `scripts/sim.ts` | Bot-vs-bot balance simulation |
| `scripts/mapPreview.ts` | Prints an authored map as annotated ASCII while designing it |

See [ASSUMPTIONS.md](md_files/ASSUMPTIONS.md) for every place the brief was ambiguous and what was chosen, [STORY.md](md_files/STORY.md) for the setting and the design sheet for every level, and [ROADMAP.md](md_files/ROADMAP.md) for what is built and what comes after.

## Controls

Click a unit to select, click a tile to move, click a visible enemy to attack. Right-click / Esc cancels.
Keys: `1`-`5` select, `M` `A` `R` `G` `O` `F` `I` action bar, `E` / Enter end turn, `V` overwatch view (range of active friendly + enemy overwatch), `Q` / wheel rotates cover while the tank is placing it.
