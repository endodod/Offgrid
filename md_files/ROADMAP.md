# Roadmap

Planned work, in the order I would tackle it. These four features come **before** designing real levels and a campaign, because they are the vocabulary the levels will be built from. Multiplayer (PvP and co-op) comes after that.

Status: none of this is started. This file is for planning; the current rules are in [ASSUMPTIONS.md](ASSUMPTIONS.md).

## Suggested order

| # | Feature | Size | Depends on |
|---|---|---|---|
| 1 | Weather | small, isolated | nothing |
| 2 | Doors and interactive map parts | medium | nothing, but shapes the map format |
| 3 | Objective types | medium | 2 (some objectives need interactables) |
| 4 | Consumables and ammo economy | medium-large | 3 (for "retrieve" objectives), balance data from the sim |

Weather can slot in at any time. 2 -> 3 -> 4 is the order that avoids rework: objectives like "sabotage 3 terminals" need interactables, and "retrieve the case" needs pickups.

## Ground rules for every feature

These are what keep the project healthy as it grows. Each feature should meet all of them.

- **Data-driven.** Numbers and definitions live in `src/data/`, never in logic (same as units, gadgets, rules today).
- **Core stays pure and deterministic.** New randomness goes through the seeded RNG in `GameState`, so `npm run sim` and any future replay or multiplayer sync stay reproducible.
- **Fog applies to everything new.** A door's state, a pickup on the floor, an objective marker: each is only shown, logged or used by the AI if that team could see it. The AI reads `visible[team]` / `seenUnits[team]` / `memory[team]` only; new information gets the same treatment (and belongs in `memory` if it should persist after being seen).
- **Tests in `src/core/`** for every new rule, in the style of the existing suites (tiny hand-made maps via `testkit.ts`).
- **The map format and builder grow with it.** New tile characters or map objects must be validated in `src/core/mapFormat.ts`, editable in the debug map builder, and covered by `mapFormat.test.ts`.
- **The sim gets a knob.** Add a flag to `scripts/sim.ts` so the effect on balance can be measured (for example `--weather rain`).
- **Readable feedback.** Anything that changes hit chance, vision or state shows up in the tooltip, the log or the HUD, not silently.

---

## 1. Weather system

**Goal:** weather that changes fog (how far units see) and accuracy for all units.

**Design sketch**
- New `src/data/weather.ts`: a list of weather types, each with modifiers. Starting set: clear, rain, heavy fog, storm, night. Example fields: `visionMult` (scales every unit's vision range), `accuracyMod` (percentage points added to hit chance), optional `rangeMult`.
- The mission or map picks the starting weather. Later it can also hold a **schedule** (weather changes on given turns) or a **weighted random change** each round drawn from the seeded RNG.
- `GameState.weather` holds the current weather. `refreshVision` scales the vision radius by `visionMult`; `hitChance` adds `accuracyMod` before the existing 5..95 clamp.
- Show it in the HUD (current weather and its effects), a light canvas overlay (rain streaks, fog tint, darker night), and a line in the hit-chance tooltip such as "Rain: -10%".

**Touches:** `src/data/weather.ts` (new), `core/vision.ts`, `core/combat.ts`, `core/types.ts`, `render/renderer.ts`, `ui/hud.ts`, `ui/session.ts` (tooltip), map builder (pick weather), `scripts/sim.ts`.

**Open questions**
- Flat modifier for everyone, or per class (a sniper suffers more in fog, an assault less)? Per-class multipliers are easy if the data allows them from the start.
- Does weather affect the bush reveal distance, overwatch, or scans? Suggest: scans ignore weather (they already ignore range and LOS), everything else follows normal vision.
- Is the forecast visible ("rain in 2 turns") so players can plan? It makes weather a tactical decision instead of a dice roll.
- Should the same weather apply to both teams? For PvP later, yes, that is the fair default.

**Tests:** vision radius shrinks with `visionMult`; hit chance shifts and still clamps to 5..95; scans unaffected; scheduled and random weather are deterministic for a given seed; the enemy AI sees less in fog too.

---

## 2. Doors and other interactive map parts

**Goal:** map pieces the units can operate, so the level layout changes during play.

**Design sketch**
- **Doors** (open/closed). Closed: blocks movement and line of sight. Open: blocks nothing. Opening costs an action (`interact`), or possibly free when a unit walks into it; decide by playtesting. Locked doors need a switch, a terminal or a key item.
- **Other parts worth having:** windows (block movement, not LOS), switches and terminals that toggle linked doors, destructible walls or barricades (a grenade opens them), explosive barrels (chain damage using the existing blast logic), retractable cover.
- The ASCII map cannot express links ("this switch opens that door"), so add an **interactables list** next to `rows` and `spawns` in `MapDef`: `{ id, type, x, y, state, links? }`. The character grid keeps the static terrain; the list carries the stateful pieces.
- Runtime state lives in `GameState` (e.g. `interactables`). `blocksMove` / `blocksLos` in `core/grid.ts` become aware of it. That is the one real refactor: today they read only terrain and cover.
- The existing `interact` action generalises from "the objective" to "an adjacent interactable", with a target parameter.

**Fog and AI**
- A door's state is only known if seen; remember the last seen state in `memory` (a door seen closed but opened later behind your back is exactly the kind of surprise fog should create).
- Opening a door is an action, so **overwatch triggers on it** and it appears in the log if seen.
- The AI needs a rule for closed doors: treat as an obstacle at first (simple), later as passable with an action cost in pathfinding (`distanceMap`, `reachable`).
- Grenades and the tank's cover gadget need defined behaviour on doors and destructibles (a grenade destroys a door? opens it?).

**Touches:** `core/types.ts`, `core/grid.ts`, `core/actions.ts` (interact target), `core/vision.ts`, `core/ai.ts`, `core/mapFormat.ts`, `data/trainingGrounds.ts` (schema), renderer (door and switch sprites), map builder (new tools plus link tool), `core/testkit.ts`.

**Open questions**
- Free versus action-cost door opening; can units close doors again; does a door block a unit standing in the doorway.
- Do doors make noise (alert enemies)? Probably not in the first version.
- One-way or timed doors? Skip until the basics feel right.

**Tests:** closed door blocks LOS and movement, open door does not; opening costs an action and triggers overwatch; a switch toggles its linked doors; the AI does not walk through a closed door; remembered state under fog; grenade behaviour; builder round-trip of interactables.

---

## 3. Different objective types

**Goal:** missions that are not all "interact and hold". Objectives become data, so each level can pick its own.

**Where we are:** one hard-coded objective (interact with the terminal, then hold 2 rounds) plus "eliminate all enemies", with `RULES.objectiveCapture` deciding who may capture. Win/lose lives in `checkWin` and the capture functions in `core/state.ts` / `core/actions.ts`.

**Design sketch**
- Replace the special case with an objective abstraction: a mission lists a **primary objective**, optional **secondary objectives** and **fail conditions**. Each objective type implements small hooks (progress check, fail check, HUD text, AI goal hint).
- Candidate types:
  - **Hold** (current): interact, then hold for N rounds.
  - **Eliminate:** kill all, or kill a specific target unit.
  - **Reach / extract:** get N (or all) units onto marked zone tiles.
  - **Defend:** keep a point or a unit alive for N rounds.
  - **Escort:** move a friendly VIP to a zone; lose if it dies.
  - **Sabotage:** interact with N terminals (needs #2).
  - **Retrieve:** pick up an item and carry it to extraction (needs #4).
  - **Survive:** last N rounds against waves.
  - Optional turn limits on any of them.
- Objective positions and parameters move into mission data (`missions.ts` / map data). The `O` map character can stay as a marker for the builder, but the definition of what the marker means belongs in data.
- The HUD objective line, the canvas markers and the home screen text are all generated from the objective definition instead of hard-coded strings.

**AI:** `pickGoal` in `core/ai.ts` currently knows only ghosts, "objective if seen" and search waypoints. Each objective type should provide goal hints for its side (attackers go for the terminal, defenders hold near it). Keep it fog-fair: an objective the enemy has not seen is not a goal (unless the mission data says the enemy is briefed).

**Touches:** `core/state.ts` (capture logic moves out), `core/actions.ts`, `core/ai.ts`, `data/missions.ts`, `data/rules.ts` (`objectiveCapture` becomes per objective), `ui/hud.ts`, renderer markers, map builder (objective tools), `scripts/sim.ts` (`--objective` needs redefining).

**Open questions**
- Which team(s) can complete an objective? The current `player | both | none` idea should carry over, and it is the natural hook for PvP asymmetric goals later.
- Are secondary objectives optional bonuses (campaign rewards) or required?
- A shared, versioned "objective state" in `GameState` so save games and campaign carry-over stay simple.

**Tests:** one suite per type (progress, completion, failure, edge cases such as the holder dying); multiple objectives; the win check picks the right winner; HUD text generation; the AI heads for the right goal.

---

## 4. Consumables on the map, and an ammo economy

**Goal:** loot and resource pressure. Units find items on the map, and ammo stops being unlimited.

**Where we are:** reserve ammo is unlimited (reload always refills the magazine), medkits are 2 per unit, gadgets have 3 uses each. Everything a unit carries is fixed at mission start.

**Design sketch**
- **Pickups:** items lying on tiles: ammo crate, medkit, grenade / gadget charge, stimulant, and later special ammo. A unit picks one up by walking onto the tile (free) or by an interact action; decide by feel. Pickups are hidden by fog until seen, and the AI can use them too.
- **Ammo economy:** give each unit a finite **reserve** (`reserve` per class in `data/units.ts`). Reload draws from it; empty reserve means no reload. Ammo crates refill reserve. Later options: adjacent units can hand over ammo (an action), special ammo types (armor-piercing, for example).
- Pressure points to think about: the Assault burst uses 1 ammo per attack (the current rule), so a small reserve punishes bursts less than expected; the Sniper has a 3-round magazine, so reserve size matters most there.
- `Unit` gets `reserve` (and possibly an inventory). New events (`pickup`, `ammoLow`) feed the log and floating text. The HUD shows reserve next to the magazine.
- Enemy AI: reload only if reserve remains; when out of ammo, seek visible pickups; consider enemy drops on death (loot for the player) as a later reward loop.

**Balance:** this is the feature where `npm run sim` matters most. Extend the per-class table with ammo used and "ran dry" rate, then pick reserve sizes from data instead of guessing.

**Touches:** `data/units.ts`, new `data/items.ts`, `core/types.ts` (unit reserve, `GameState.pickups`), `core/actions.ts` (reload, pickup), `core/ai.ts`, `core/mapFormat.ts` and the builder (place pickups), renderer, HUD, `scripts/sim.ts`.

**Open questions**
- How scarce should ammo be for a tutorial-style Training Grounds versus later missions? Probably a per-mission setting (`reserveMult`), not a global constant.
- Persistence between missions is a campaign question (see below): do unused consumables carry over?
- Are pickups spawn-fixed by the map, or partly randomised from the seeded RNG?

**Tests:** reload consumes reserve; no reload with an empty reserve; pickups apply their effect and disappear; fog hides pickups; the AI reloads only with reserve and goes for pickups when dry; sim table stays sane.

---

## After these: levels, campaign, multiplayer

Not planned in detail yet. These notes record what the four features above enable, and what in today's code will need attention.

**Levels and campaign**
- The four features give level design its vocabulary: per-level weather, objective type, doors and switches, pickups.
- A campaign needs mission definitions to grow beyond one entry in `missions.ts` (ordering, briefing text, unlock rules) and a **save format** for progression: unit HP carry-over, consumables, unlocks. Keep `GameState` serialisable now; it mostly is (plain data, seeded RNG state), apart from `Set`s such as `seenUnits`, which are derived anyway.
- The map builder becomes a real level editor at that point (multiple maps, per-map objective and weather settings, validation).

**Multiplayer (PvP and co-op)**
- The design already helps: the rules core is pure and deterministic, all actions go through `validate` / `perform`, and fog and memory are tracked **per team**. That fits either a server-authoritative model or lockstep (each client replays the same action list from the same seed).
- Things in today's code that assume one human against the AI: `Team` is `'player' | 'enemy'` and the AI always drives `'enemy'`; `GameEvent.seen` is computed for the player team only, so PvP needs per-team visibility of events (or filtering on the server); `Session` assumes one local human. PvP means a human on both sides; co-op means several humans on one team, so decide simultaneous versus alternating phases and add timers.
- Hidden information (the other team's `memory`, RNG state) must never be sent to the client that should not have it.
- Objectives that can be completed by either side (see #3) are the hook for asymmetric PvP scenarios.
