# Assumptions

Where the brief was silent or ambiguous I picked a default. Everything numeric lives in `src/data/`.

## Rules I had to interpret

**Geometry**
- Ranges, vision, scan radius and gadget range use **Euclidean distance** (`dist <= range`). The grenade blast is a **3x3 square** (Chebyshev radius 1). "Adjacent" (first aid, interact) includes **diagonals**.
- Movement costs 1 per step, diagonals included, no corner-cutting past a blocked tile. **Units block movement** (friend and foe). Walls, cover objects and the objective tile are impassable; bushes are walkable.
- **Walls count as high cover** for hit chance (-40 when a wall is on the edge facing the attacker, and they count for the diagonal check and for "flanked" like any cover). This is only used for the hit-chance rule: grenades and the tank's cover gadget still ignore walls, so a wall can't be destroyed or upgraded. Shield icons are drawn on edges that face a wall too.
- Line of sight is Bresenham between tile centres, made symmetric (A sees B iff B sees A). Endpoints never block. A diagonal step squeezing between two blockers counts as blocked.
- **Only walls block line of sight.** Units can see and shoot over both low and high cover, so head-on shots at a target behind high cover are possible and take the full -40. `RULES.highCoverBlocksLos` (default `false`) switches the old behaviour back on: high cover then blocks LOS like a wall.

**Cover**
- The facing neighbour is chosen by angle (a diagonal shot checks both facing edges and takes the better one; they don't stack): if one axis is at least twice the other, only that side counts; otherwise the attacker is "diagonal" and both facing neighbours are checked (best wins).
- The tooltip separates **none** (no cover anywhere around the target) from **flanked** (cover exists, but not on the side facing the attacker). Both give no bonus.

**Combat**
- Attacking needs the attacker's own LOS + range, and the target must be **visible to the attacker's team** (so a spotter, or a scan, can enable a shot; a bush-hidden unit cannot be targeted).
- Grenade damage is a flat 3 and ignores armor. Cover in the whole blast square is transformed (high -> low, low -> destroyed). The throw needs a visible tile but no LOS (it is a lob).
- Tank cover: the target must be a visible tile within 2, not a wall, not occupied, not the objective, and not already high cover. Bush tiles are allowed.
- First aid refuses a full-HP target; healing is capped at max HP. Reload refuses a full magazine.
- Killing blow on a burst stops the remaining shots. Friendly-fire kills count for the game state but not for kill/damage stats.
- Both teams eliminated at once (a grenade) = draw.

**Overwatch**
- Needs at least 1 ammo to set. While set, the unit **cannot attack** (weapon reserved); other actions are allowed, and moving does not cancel it.
- It triggers on **every step of an enemy move** and **after any other enemy action** (attack, reload, gadget, aid, interact), if the actor is in range, in the watcher's LOS and visible to the watcher's team. Each watcher fires at most once. A mover killed mid-path stops.
- It lasts through the other team's phase and is cleared at the start of the owner's next phase.

**Gadgets**
- Cooldown is a counter set to 3 on use and ticked at the start of each of the owner's phases: used on turn N, ready on turn N+3. The HUD shows "ready in X turns".
- Scan may target **any tile**, even fogged ones (otherwise it could never reveal anything). It lasts the turn it is cast plus the next one.
- Adrenaline costs 1 action and **restores 2** (`actionsRestored`), so the unit ends with a net +1 action. That can put it above the usual 2 actions for the turn (2 -> 3). It also adds `moveBonus` (4) tiles to the unit's **next move action** this turn. The bonus is used up by that move however short it is, and disappears at the end of the turn if unused; it can't be stacked. Set either value to 0 in `gadgets.ts` to drop that half.

**Fog of war**
- The "observer within 2 tiles" bush rule uses Euclidean distance and counts any living unit of the observing team.
- Ghost markers are cleared when the enemy dies, when a friendly unit gets within 1 tile, or when the ghost's tile is looked at again after having been out of sight. A unit hiding in a bush leaves its ghost where it was last actually seen, so it doesn't leak its position.
- The combat log obeys fog too: events the player could not see are dropped, except a generic "gunfire echoes from the fog" line.
- **Bush exposure:** a unit that does anything except move while standing in a bush (attack, reload, overwatch, gadget, first aid, interact, or a reaction shot from overwatch) is **exposed**. It is visible and targetable in the bush until the start of its own team's next phase, so the opponent gets their whole next phase to punish it. Moving never exposes, and the tile still has to be in view (fog/walls still hide an exposed unit). Exposed units show an orange `!` and are listed in the log and tooltip.
- The debug fog toggle only reveals things to the human. It never feeds the player's memory, and the AI is unaffected.

## Objective and win/lose
- The objective is an impassable terminal; interact from any of its 8 neighbours (1 action).
- **Interact starts a hold, it does not win by itself.** The interacting unit must then stay on its tile for `RULES.objectiveHoldRounds` (2) rounds. One round passes at the start of each of the capturing team's phases: interact on turn N, win at the start of turn N+2. The hold is broken if that unit **moves off its tile or dies** (any other action, like shooting or reloading, is fine), and someone has to interact again. Only one hold can run at a time.
- `RULES.objectiveCapture` (`player` | `both` | `none`), default **`player`** as in the brief: only the player can start a hold, and the enemy just heads for the terminal and stands guard. `both` and `none` exist for the simulator. An AI unit that is holding doesn't walk away: it shoots what it sees or goes on overwatch.
- Eliminating all enemies still wins as well.

## Medic
- A soldier variant: same weapon and Move/Vision, but **9 HP and 0 armor** (soldier: 12 / 1). It has no grenade; its gadget is **Medkit**: heal a wounded friendly unit (or itself) within **2 tiles** to full HP. It uses the normal gadget rules (3 uses, 2-turn cooldown). This is separate from the first-aid action, which every unit has (heal 3, own 2 medkits, adjacent only).
- The AI never uses gadgets, so the sim's medic is just a frail soldier.

## Cover rotation
- Low cover has an orientation (quarter turns) that is **purely visual**: it does not affect hit chance, LOS or cover facing.
- In the map, `l` is unrotated and `1` `2` `3` are low cover rotated 90/180/270 degrees. The tank picks the rotation of the cover it places (Q / Shift+Q or mouse wheel while aiming; a ghost preview shows the piece). Upgrading low -> high, or a grenade downgrading high -> low, keeps/sets the rotation the same way; high cover is drawn the same at any rotation.

## Enemy AI
- Uses only `seenUnits[team]`, `visible[team]` and `memory[team]`, the same fog rules as the human.
- Units act one at a time, in id order. Shooters step to the best cover tile that keeps range + LOS (only when they have 2 actions), shoot the highest expected-damage target, reload when empty. Cover dominates the tile score; the tie-breakers are expected damage, then a short walk.
- With no target: chase the nearest ghost, else the objective if seen, else a **search waypoint** (`searchPoints` in the map file, so the AI doesn't secretly know where the objective is). It ends the phase on overwatch. It never uses first aid.
- Known weakness: units block movement and the AI doesn't plan around allies, so it can jam at chokepoints (e.g. the courtyard door). It is deliberately simple and replaceable via `planAction` in `src/core/ai.ts`.

## Simulator (`npm run sim`)
- The same AI plays both sides, no gadgets on either side (the AI doesn't know how to use them), so the numbers are gadget-free.
- Default is `--objective none` (pure elimination), which measures combat balance. With capture enabled the AI beelines for the objective and the game ends in about 2 turns. Options: `--n`, `--seed`, `--max-turns`, `--objective none|player|both`.
- Matches are seeded `seed..seed+n-1`. The map is not symmetric, so player-vs-enemy win rate mixes map bias with class balance.
- A match that runs past `RULES.maxTurns` counts as a draw.

## Map and missions
- Spawns are a list of `[class, x, y]`, so a team can field several units of a class. The Training Grounds fields **5 friendly units** (sniper, assault, soldier, medic, tank) against **5 enemies** (sniper, 2x medic, 2x assault). The enemy spawns sit right next to the objective's walled courtyard while the player spawns are spread across the far side of the map, so `--objective player|both` is now a fast, near-deterministic enemy win by capture; `--objective none` (the sim default) is the one that measures combat balance. With 5-unit squads funnelling through the courtyard's single doorway, enemy units can also jam each other there and never reach combat range at all in elimination mode (the "Known weakness" below) - this is a map/AI-scale issue tracked for the roadmap's AI rework, not a balance guarantee.
- Missions are listed in `src/data/missions.ts` and shown on the home screen. Leaving to the menu discards the current game; entering a mission starts it fresh.
- "Some cover destructible, some upgradeable" is implemented as **all** cover being both (the rules don't distinguish). The features are simply placed in different areas. A feature table is at the top of `src/data/trainingGrounds.ts`.

## Debug mode and map builder
- `VITE_DEBUG=true` (read from `.env.local`, or the shell) is the only switch. I created a git-ignored `.env.local` with it on for your dev machine; delete it or set it to anything else to hide everything. A production build has it off unless the variable is set at build time.
- Saved custom maps live in the browser's localStorage (per browser and per origin), keyed by mission id, and are only used in debug mode. To make one permanent, export the JSON and paste the rows/spawns into the map data file.
- The builder edits the same 24x16 grid (no resizing) and the same tile characters as the data file. Spawns can be any mix of classes on either team. The AI search waypoints are not editable; waypoints that end up inside an obstacle are dropped.
- Saving and playtesting are blocked only when a team has no units. Missing objective and unreachable units/objective are shown as warnings.

## UI
- Range displays are **tile-based**: attack mode tints the tiles the unit can actually shoot (weapon range and line of sight), scans tint the tiles they reveal, and gadget targets highlight valid tiles. No circles.
- **Overwatch view** (button or `V`) is the only place overwatch range is drawn: it tints the weapon coverage (range + LOS) of units that are currently on overwatch, friendly green and enemy red (enemies only if you can see them); overlaps stack darker. Outside the view, an active overwatch is shown only by the red eye icon on the unit.
- The enemy phase plays one action per ~420 ms. Right-click or Esc cancels a targeting mode. A hovered enemy's cover state is computed relative to the selected unit.
- First aid with exactly one valid target (usually self) is applied immediately.
- "Skip enemy phase" is a persistent toggle (the enemy simply passes) rather than a one-shot button.
- In dev mode `window.session` is exposed for console poking.
