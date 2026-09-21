# Roadmap

Planned work, in the order I would tackle it. Features 1-4 come **before** the meta-game layer (5-8), because they are the vocabulary the levels and missions will be built from. Multiplayer (PvP and co-op) comes after that.

Status: none of this is started. This file is for planning; the current rules are in [ASSUMPTIONS.md](ASSUMPTIONS.md).

## Suggested order

| # | Feature | Size | Depends on |
|---|---|---|---|
| 0a | UI/UX clarity pass (hover info, redesign) | medium | nothing, but every later feature should be built against the clearer UI |
| 0b | Revive mechanic | small-medium | nothing |
| 0c | Enemy AI rework (habitat & difficulty profiles) | medium-large | nothing, but pairs well with mission data from 5 |
| 0d | Friendly AI for auto-run missions (supply runs) | medium | 0c (shares the profile/planAction rework), most useful once 5 exists (supply runs to delegate) |
| 0e | Hotkey settings | small | nothing, but easiest to add alongside the 0a redesign (action tooltips can show the bound key) |
| 0f | Tutorial: walk through every mechanic and action | medium | 0a (reuses its hover/tooltip work), most effective once 0b-0e exist so it can cover them too |
| 1 | Weather | small, isolated | nothing |
| 2 | Doors and interactive map parts | medium | nothing, but shapes the map format |
| 3 | Objective types | medium | 2 (some objectives need interactables) |
| 4 | Consumables and ammo economy | medium-large | 3 (for "retrieve" objectives), balance data from the sim |
| 5 | Campaign map & mission generation | large | 3 (objective variety), 4 (supply runs feed the ammo economy) |
| 6 | Base building | medium-large | 5 (base needs a campaign layer to sit in) |
| 7 | Unit equipment screen (armor + 2 slots, loot system) | medium-large | 2 and 4 (chests and enemy drops need interactables and pickups), 6 for buying/crafting |
| 8 | Unit leveling & perks (per-class paths, growing perk pool & slots) | medium-large | pairs with 7 (perks and equipment both modify a unit's effective stats) |

0a-0f go first: they are core game-feel, not content, and every feature after them (new hazards, objectives, pickups, mission generation) needs the clearer UI, the revive mechanic, a more capable AI, configurable controls and a way to teach all of it already in place instead of retrofitted later. 0d builds directly on 0c's AI rework, and 0f is easiest last among these since it can then cover 0b-0e as well as the base rules, so do them in roughly that order even though most of them can start immediately. Weather can slot in any time after that. 2 -> 3 -> 4 is the order that avoids rework: objectives like "sabotage 3 terminals" need interactables, and "retrieve the case" needs pickups.

5-8 are the meta-game layer: base -> equip/level the squad -> pick a mission from the campaign map -> play it -> return to base. Unlike 1-4 (each buildable and testable against the single Training Grounds mission), these need at least a minimal second mission and a persistent save file to test end-to-end, so they naturally come after.

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

## 0a. UI/UX clarity pass: hover info and redesign

**Status: done** (hover/tooltip layer only — see the resolved open questions below for what was deliberately deferred).

**Goal:** a player can tell what will happen before committing to an action, everywhere in the game, without reading the code or guessing. This is a prerequisite for every feature above: new hazards, objective types and pickups all add more state the player has to read correctly.

**Where we are:** `Session.hoverInfo()` now branches by mode. Move mode shows path cost, AP remaining and a fog-fair danger flag (`moveHoverInfo`/`dangerAt` in `ui/session.ts`) drawn on `seenUnits`/`visible` only, never hidden state; the move itself is also drawn as a breadcrumb arrow from the unit to the hovered tile (`View.path`, `render/renderer.ts`'s `drawMovePath`). Gadget mode (`gadgetHoverInfo`) previews each gadget's effect at the hovered tile: grenade blast damage and who (visible) it would catch, cover placement result, medkit heal amount, scan reveal radius, and a clear "Cannot target: &lt;reason&gt;" when blocked. The existing enemy-hover tooltip (hit chance, armor, HP, cover, blocked-shot reason) is unchanged and already covered every attack-capable action since it isn't gated by mode. Every action bar button now gets a hover/focus tooltip (`Hud.buttonTip`, using `aria-disabled` instead of the native `disabled` attribute so a disabled button can still be hovered/focused) showing a one-line description, its cost, and why it's disabled when it is. The `#tip` element is `position: fixed` and reused for both canvas-tile and button tooltips, rendered through one `Hud.renderTip()` path kept deliberately separate from the full `Hud.update()` (which rebuilds the action bar's `innerHTML` — calling that from a hover/focus listener detaches the very button being hovered, breaking both real hover stability and any automated UI check).

**Design sketch**
- **Movement hover:** hovering a reachable tile shows path length/AP cost, AP remaining after the move, and whether the destination is inside known enemy overwatch or visible to any seen enemy (a "danger" flag drawing on `visible`/`memory`, never on hidden information).
- **Attack hover:** extend the existing enemy-hover tooltip to cover every attack-capable action (not just the default attack), including gadgets with an attack effect, and to state clearly when a shot is blocked (no LOS) rather than just omitting numbers.
- **Action hover:** every action button (interact, reload, overwatch, gadget, wait, revive once 0b lands) gets a hover/focus tooltip with a one-line description, AP cost, and why it is disabled when it is (no ammo, no target in range, already used this turn).
- **Redesign pass:** consolidate hover/tooltip rendering into one shared component/style (`ui/style.css` plus a single tooltip builder) instead of ad hoc strings per feature, so weather, doors, objectives and pickups can each add a line without a bespoke UI each time. Review HUD layout, button grouping and iconography for anything that currently requires prior knowledge of the rules to understand (e.g. unlabeled numbers, ambiguous icons).
- Keyboard/gamepad-friendly: hover info should also appear on focus, not only mouse hover, so keyboard selection of tiles/actions isn't second-class.

**Touches:** `ui/session.ts` (`hoverInfo` and a new move/action-hover equivalent), `ui/hud.ts`, `ui/style.css`, `render/renderer.ts` (danger/path highlighting), no changes expected to `core/` (this is presentation over existing state, using only `visible`/`seenUnits`/`memory` like everything else fog-related).

**Resolved**
- Danger highlighting is computed entirely in the UI layer (`Session.dangerAt`) from `seenUnits`/`visible`/unit state already on `GameState` — no new `core` field needed, `core` stays untouched by this feature as planned.
- Went with full numbers, not a summary/expansion: each tooltip is already short (2-4 lines) since it's scoped to one mode's relevant facts, so a "hold for detail" step would add a click without reducing clutter.
- Layout deferred: this pass is the hover/tooltip layer only. HUD/action-bar layout, button grouping and iconography are unchanged and remain open for a future pass if the need shows up once more features (doors, objectives, pickups) have added their own lines to these same tooltips.

**Tests:** `src/ui/session.test.ts` (new) covers the new logic directly — `Session` has no DOM dependency, only `Hud` does — path cost/actions-remaining for a reachable tile, null fallback when unreachable, the danger flag firing only for a *seen* overwatching enemy and never leaking for an unseen one, and gadget-hover previews (grenade catch list, blocked-target reasons). The button-tooltip and move-path-arrow rendering were checked manually via a driven headless browser (hover/focus every action button including a disabled one, move/gadget/attack hover, screenshots) rather than added as automated tests, consistent with this being presentation over already-tested rules.

---

## 0b. Revive mechanic

**Status: done.**

**Goal:** a downed unit is a tactical situation to react to, not an instant, permanent loss.

**Where we are:** `Unit.downed`/`bleedOut` (`core/types.ts`) sit between alive and dead. `applyDamage` (`core/combat.ts`) downs a unit at 0 HP instead of killing it (`RULES.bleedOutRounds = 3`, `RULES.reviveHp = 4`); any further hit on an already-downed unit kills it for good regardless of amount, and an `attack` action against a downed target (`fireWeapon`) is a guaranteed "finishing shot" that bypasses the hit-chance roll entirely, since it can't fight back or move. `state.ts`'s `endTurn` ticks `bleedOut` at the start of the downed unit's own team's phase and calls the relocated `checkWin` (moved from `actions.ts` so `state.ts` can call it without a circular import). A new `revive` action (`reviveBlock`/`perform`'s `'revive'` case) lets an adjacent ally spend an action and one of *their own* personal medkits (the same resource first aid uses) to clear `downed` and restore `RULES.reviveHp`. First aid and the medic's ranged medkit gadget both explicitly refuse a downed target ("Downed - use Revive instead") so healing can't silently leave a unit downed-but-full-HP.

Fog: downed units are still ordinary alive units positionally, so they're covered by the exact same `visible`/`seenUnits`/`memory` machinery as everything else - no new fog logic was needed, just excluding downed units from *projecting* vision themselves (`core/vision.ts`) since they're incapacitated, not watching. AI (`core/ai.ts`): finishing a visible downed enemy always outscores any other target (`evaluate`'s `value()` treats it as a guaranteed kill); an already-*adjacent* downed ally is revived before the AI even considers whether to fight (costs nothing positionally, so it isn't a real trade-off against combat); a non-adjacent downed ally is chased only once no enemy is visible, so revive-seeking never abandons an active fight. All of this is gated by a new `GameOptions.aiRevive` (default true, `--no-ai-revive` in `scripts/sim.ts`) so the sim can A/B it; `MatchResult`/`UnitResult` now carry `revives` and `downedAtEnd` and the sim prints both.

UI: a `Revive` button (key `U`) alongside First Aid, with the same "auto-cast if exactly one valid target, otherwise enter targeting mode" pattern as First Aid; move/gadget-hover-style previews for revive-mode hover and a downed status line on the enemy/ally hover tooltips (0a's tooltip infrastructure absorbed this without needing new plumbing). Roster and the canvas both mark a downed unit distinctly (dashed red outline, prone sprite, bleed-out countdown) instead of the normal HP/action-pip display.

**Resolved**
- Bleed-out timer: fixed at 3 rounds for every class (`RULES.bleedOutRounds`), not per-class - simplest to read and to balance later via the sim.
- A downed unit can be finished off by a normal `attack` action (same action/ammo cost as any attack) - it's a guaranteed kill rather than a probability roll, since the target can't react. A burst that downs its target mid-way through stops firing the rest of that burst rather than auto-finishing it; a follow-up shot is a separate, deliberate action.
- Going down does **not** count as eliminated for Eliminate-style objectives (`checkWin` still requires `alive === false`) - a team with only downed units left is still "in the fight" until someone finishes them or they bleed out, which is the intended source of tension.
- Revive only clears `downed`/`bleedOut` and sets HP; there's no status-effect system yet for it to interact with.

**Tests:** `core/revive.test.ts` (new) covers the full checklist below directly; `core/actions.test.ts` and `core/combat.test.ts` had a handful of pre-existing tests updated where a lethal hit used to mean instant death and now means downed (the underlying behaviour they were checking - e.g. "a burst stops once its target is out of the fight" - still holds, just phrased against `downed` instead of `alive`).
- HP reaching 0 downs rather than removes the unit. ✓
- Downed unit cannot act (validated at the top of `validate()`, and `aiTurn` never yields it a turn). ✓
- Bleed-out timer kills it after N rounds if not revived, ticking only at its own team's phase start. ✓
- Revive restores partial HP (capped to class max) and clears downed status, consuming the reviver's medkit. ✓
- A downed unit stops projecting vision but is still seen/hidden by the same fog rules as any unit. ✓
- The AI revives an adjacent downed ally, chases a distant one when no enemy is visible, and prioritizes finishing a visible downed enemy over a healthy target - each independently unit-tested, plus an `--no-ai-revive` test confirming the knob actually disables it. ✓
- Win/lose checks handle downed-but-not-dead units correctly: no win while the "eliminated" side still has downed survivors, win fires the moment the last one is finished off or bleeds out. ✓

---

## 0c. Enemy AI rework: habitat and difficulty profiles

**Status: done.**

**Goal:** enemy behaviour varies by mission instead of every enemy on every map playing the same script, and difficulty can be tuned by making enemies smarter or dumber rather than just tankier or harder-hitting.

**Where we are:** `data/aiProfiles.ts` (new) defines `AiProfileDef { name, habitat, reactionChance, retreatBelowHp?, blurb }` and five named profiles (`standard`, `easy`, `hard`, `camper`, `ambush`), keyed by `AiProfileId`. `GameState.aiProfiles: Record<Team, AiProfileId>` is resolved in `createGame` from `GameOptions.enemyProfile`/`playerProfile`, falling back to `MapDef.enemyProfile`, falling back to `'standard'` - the same override-chain pattern weather/time-of-day already established. `core/ai.ts`'s `planAction` reads the acting unit's team profile each decision:
- **Habitat** gates idle behaviour (`pickGoal`) when no enemy is visible - `patrol` (default) chases ghosts, the objective, then search waypoints exactly as before; `camper` skips ghosts/waypoints and only advances toward a *seen* objective, otherwise holds; `ambush` never moves at all pre-contact, not even toward the objective. Habitat also gates the "reposition to a better cover tile" step while in combat: every habitat except `camper` still takes it, so a camper that already has a shot never voluntarily leaves its position, but if it currently has *no* shot at all (e.g. a target spotted just past weapon range) it still closes the distance via the same unconditional "chase the nearest enemy" fallback every habitat uses.
- **`reactionChance`** (rolled via the same seeded `rollPercent` combat uses, so it's deterministic and test-overridable the same way) is difficulty as decision quality: below the roll, the unit just holds/overwatches instead of taking its best move or shot. `1` (every profile but `easy`) short-circuits without rolling at all, so it's a true no-op for the regression baseline.
- **`retreatBelowHp`** (only `hard`) is self-preservation: below that HP fraction, with a visible enemy and not holding the objective, the unit falls back to the reachable tile furthest from the nearest threat instead of fighting on - deliberately not a stat multiplier, per the design sketch's own preference.

An already-adjacent downed ally is still revived before any of this is even considered (0b), since it costs nothing positionally and isn't really a "combat decision." `ui/hud.ts`/`session.ts` got a debug-only "Enemy AI" selector (same pattern as the time-of-day/weather ones) for quick manual QA; it isn't shown in the non-debug mission panel (deferred - see below).

Profile resolves in three tiers, each overriding the last: `Spawn`'s optional 4th element (a per-unit override, `Unit.aiProfile`) beats `MapDef.enemyProfile`/`GameOptions.enemyProfile` (the squad/mission default) beats `'standard'`. The map builder (`ui/builder.ts`) exposes the per-unit tier directly: an "Enemy AI" dropdown next to the unit-class picker (shown only for the enemy-unit tool) sets the habitat/difficulty painted onto the *next* enemy unit - e.g. one camper covering a doorway while the rest of the squad patrols. Picking `standard` there leaves the spawn's 4th element out entirely rather than writing a redundant explicit `'standard'`, so a mission's own default can still change later without having to re-edit every already-placed unit. Changing an existing unit's profile works the same way class does today: erase and repaint it with the new profile selected - there's no in-place property editor yet.

**Resolved**
- Profile is per mission/squad by default (`MapDef.enemyProfile` / `GameOptions.enemyProfile`), with an optional per-unit override via `Spawn`'s 4th element for the cases (mixed squads, one unit playing a different role) where the mission-wide default isn't enough - see above. This lands between the two options the open question posed: not purely per-mission, but the override is opt-in per unit rather than mandatory per spawn.
- `GameOptions` also carries an independent `playerProfile`, unused by real missions (the player is human) but letting `scripts/sim.ts` and 0d's future friendly-AI both reuse the exact same profile system without another refactor.
- Difficulty stays enemy-side only for now; nothing about the player's own resupply/economy changes with it. Revisit once there's an economy (#4) worth restricting.
- Collapsed the design sketch's separate "aggression" axis into habitat itself, rather than a third overlapping knob - `patrol`/`camper`/`ambush` already span the push-vs-hold spectrum the sketch described, and a second continuous slider over the same axis would just make profiles harder to reason about for no real gain in expressiveness yet.
- Doors/interactables (#2) don't exist yet, so camper/ambush-vs-doors is deferred to whichever feature lands second; nothing here should need revisiting since habitat is read fresh every decision, not baked into a plan.

**A finding from the sim, left for later balance work:** `hard`'s retreat currently makes the enemy *win less* against a `standard`-profile player in a symmetric skirmish (measured via a hand-built map, not Training Grounds - see Tests), in both a tight room and a wide-open one. Retreating costs an action that could have been a shot, and against an equally mobile, equally aggressive opponent that just keeps closing, the unit never reaches genuine safety - so it trades offense for a delay that doesn't pay off. The mechanism itself is correct (it reliably falls back once hurt, and only when a strictly safer tile exists); this is a tuning problem, not a bug, and the fix likely needs retreat to target actual cover or a position an ally can cover, not just "further from the nearest threat." Recorded here rather than hidden so a future pass has the data point instead of re-discovering it.

**Tests:** `core/aiProfiles.test.ts` (new, 15 tests) - the default ('standard') profile never even rolls (regression-safe by construction, not just by coincidence); each habitat's idle behaviour is independently distinguishable (patrol uses waypoints, camper ignores them but still defends a seen objective, ambush never moves and then fights normally once triggered); camper's in-combat reluctance to reposition, and that it still closes distance when it has no shot at all; `reactionChance` both failing and passing; `retreatBelowHp` firing under threshold, not firing above it, and not firing while holding the objective. A separate hand-built-skirmish check (not committed - see the finding above) confirmed `easy`/`standard`/`hard`/`camper`/`ambush` all produce measurably different win rates via `scripts/sim.ts`'s new `--enemy-profile`/`--player-profile` flags.

---

## 0d. Friendly AI for auto-run missions (e.g. supply runs)

**Goal:** the player can hand a low-stakes mission, such as a supply run, to AI control of their own squad instead of playing every turn manually.

**Where we are:** `aiTurn(s, team)` in `core/ai.ts` already takes a `Team` and is not hardcoded to `'enemy'` — it is simply invoked for `'enemy'` today (`runAiTurn(s, 'enemy')`). Nothing currently calls it for the player team, and `planAction`'s current behaviour (cover-seeking, holding, chasing search waypoints) is tuned for an opposing squad, not necessarily what a player would want done with their own.

**Design sketch**
- A **friendly** behaviour, most naturally expressed as another profile alongside 0c's rework: prioritize squad survival and objective completion over aggression, avoid needless exposure, and read only `visible['player']`/`seenUnits['player']`/`memory['player']` the same as a human player would — a friendly AI must never see anything the player themself couldn't have.
- An **auto-run** mode: the game loop calls `aiTurn(s, 'player')` with the friendly profile each player phase instead of taking manual input, fast-forwarding the mission. Offer a way to hand control back mid-mission (e.g. on taking a casualty, or on request) rather than making it strictly all-or-nothing.
- Pairs naturally with the campaign layer's supply-run generation (#5): low narrative stakes, so a player who doesn't want to hand-play every mission can auto-resolve the routine ones and get the outcome, while story missions stay manual.
- UI: an "auto-run" toggle on missions that support it, a fast-forward/skip control while it plays out, and a results summary (casualties, loot, objective outcome) for a player who isn't watching turn by turn.

**Touches:** `core/ai.ts` (friendly profile / planAction variant), `ui/session.ts` (auto-run mode and speed control), a new mission-results summary UI, `data/campaign.ts`/`data/missions.ts` (mark which mission templates are auto-runnable, ties into #5), `scripts/sim.ts` (already runs both sides via AI, so it's a natural place to validate the friendly profile too).

**Open questions**
- Is auto-run available on any mission, or gated to specific templates (supply runs) below some risk threshold?
- Full permadeath during an auto-run same as manual play, or does the friendly AI get a safety margin (e.g. it will retreat rather than push a losing fight) to keep auto-run genuinely low-stakes?
- Can the player interrupt an in-progress auto-run to take manual control, or only start/stop between missions?

**Tests:** the friendly profile reads only the player team's fog state (no cheating using enemy information); an auto-run mission resolves deterministically for a given seed; every action taken during auto-run passes the same `validate` a manual action would; the results summary matches the final `GameState`.

---

## 0e. Hotkey settings

**Goal:** the player can see and rebind every keyboard shortcut instead of living with a fixed layout.

**Where we are:** `ui/input.ts` hard-codes a single `KEYS` map (`m`/`a`/`r`/`g`/`o`/`f`/`i`/`e`/`Enter` to buttons) plus a handful of inline checks (`Escape` to cancel, `v` to toggle overwatch view, `q`/`shift+q` to rotate cover, `1`-`5` to select a unit). There is no settings/config concept anywhere in the UI layer, no persistence, and no in-game list of what any key does.

**Design sketch**
- A `KeyBindings` structure (new, e.g. `ui/keybindings.ts`) mapping each bindable action (`ButtonId` plus the extra actions above: cancel, toggle overwatch view, rotate cover CW/CCW, select unit 1-5) to a key, with the current `KEYS` map becoming the shipped default rather than the only option.
- A settings screen listing every binding with a "click to rebind" control (press a key to capture it), conflict detection (warn or block if a key is already bound to something else), and a reset-to-default action.
- Persist bindings in `localStorage` (this is a single-player, browser-side concern today; if a save-file system arrives with the campaign layer (#5) it's a natural place to store this too, but it shouldn't have to wait for that).
- `bindInput` reads from the active `KeyBindings` instead of the hard-coded map and inline `ev.key` checks, so every one of today's shortcuts becomes rebindable, not just the ones already routed through `KEYS`.
- Ties into the 0a hover/tooltip work: once actions show hover tooltips, the tooltip is the natural place to also show the currently bound key (and stays correct automatically after a rebind).

**Touches:** `ui/input.ts` (read bindings instead of the hard-coded map and inline checks), `ui/keybindings.ts` (new: default bindings, load/save), a new settings screen/UI, `ui/hud.ts`/action tooltips (show the bound key once 0a lands).

**Open questions**
- Does this cover mouse-bound actions too (e.g. rebinding right-click-to-cancel), or keyboard only for the first version?
- Should there be more than one named profile (e.g. presets for left-handed play), or just one set of rebindable defaults?
- Any reserved keys that should never be rebindable (`Escape`, for instance) to avoid a player locking themselves out of canceling an action?

**Tests:** default bindings match today's behaviour exactly (regression safety); rebinding a key changes what `bindInput` dispatches for that key and stops dispatching on the old one; conflicting bindings are caught; bindings persist across a reload; reset-to-default restores the shipped `KEYS` map.

---

## 0f. Tutorial: walk through every mechanic and action

**Goal:** a new player learns the rules and every action by playing a guided first mission, instead of guessing from the HUD or reading the code.

**Where we are:** there is no tutorial or help system anywhere in `ui/`. The only onboarding today is the Training Grounds mission's one-line `blurb`/`objective` text in `data/missions.ts`, and it doubles as a general rules-exercise map (sniper lane, street crossing, cover, bushes, a hidden room, a walled courtyard) rather than a guided walkthrough — a new player is dropped into the full mission with no explanation of move, attack, cover, overwatch, gadgets, interact, or the fog-of-war rules governing what they can see.

**Design sketch**
- A **guided mode** layered on top of a mission (Training Grounds is the natural first candidate): step-by-step prompts that wait for the player to perform (or explicitly skip) a specific action before advancing — select a unit, move it, take a shot, use overwatch, interact with the objective, use a gadget, and so on through every `ButtonId`.
- Each step highlights the relevant UI element (the button, the hovered tile) and shows explanatory text, reusing the hover/tooltip infrastructure from 0a rather than inventing a second explanation system — a tutorial step is effectively "force this tooltip to show, plus a sentence of extra context."
- Steps are data, not hard-coded UI flow, so it stays maintainable as new mechanics ship: a small `data/tutorial.ts` (or similar) listing steps as `{ id, trigger, prompt, highlight }`, checked against `GameState`/`Session` events (e.g. "player performed a move action" satisfies the move step). This also means later features (doors, objective types, consumables, weather, revive, hotkeys) can each register their own step instead of the tutorial content going stale.
- Skippable and replayable: a "skip tutorial" option for returning players, and a way to revisit it later (e.g. a help/tutorial entry on the home screen) rather than only a one-time first-run experience.
- Scope for the first version: covers the core actions and rules that exist today (move, attack, reload, overwatch, gadget, interact, cover, fog/vision basics, end turn); extend it as 0b-0e and 1-4 land rather than trying to cover unbuilt features up front.

**Touches:** `data/tutorial.ts` (new: step data), a new `ui/tutorial.ts` (step sequencing, highlight overlay, prompt text), `ui/session.ts`/`ui/hud.ts` (hooks to detect when a step's action was performed, and to force-show a tooltip for a highlighted element), `ui/home.ts` (entry point / replay option), `data/missions.ts` (mark Training Grounds, or a dedicated tutorial mission, as tutorial-capable).

**Open questions**
- Reuse Training Grounds as the tutorial map, or build a smaller, purpose-built tutorial map so early steps aren't cluttered by the full rules-exercise layout?
- Does the tutorial block real mission progress/objective completion until each step is satisfied, or run alongside normal play as optional callouts a player can ignore?
- Does it need to cover the enemy AI/fog-of-war explicitly (e.g. "you can't see that unit because of cover"), given how central fog is to this game's identity?

**Tests:** step data validates (every step's trigger corresponds to a real action/event); a scripted playthrough of all steps in order completes the tutorial; skipping works at any point; a step's highlight/prompt correctly reuses the 0a tooltip system rather than duplicating it.

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

## Meta-game layer

The features above give a single tactical mission its vocabulary. These four turn that into an actual game loop: base -> equip/level the squad -> pick a mission from the campaign map -> play it -> return to base. They need at least a minimal second mission and a persistent save file to test end-to-end, so they come after 1-4.

## 5. Campaign map & mission generation

**Goal:** a map/menu screen between missions where the player picks the next mission. Some missions are auto-generated from a pool (supply runs and similar); one story mission per act is handcrafted and fixed for that playthrough.

**Design sketch**
- `data/campaign.ts` (new): the story mission sequence, plus the supply-run generation pool — mission templates parameterized by map, enemy count/composition, objective type (#3), and a reward table.
- A `CampaignState` (new, alongside `GameState`) tracking which missions are available, completed or locked, persisting between sessions.
- Generation draws from the existing seeded RNG so a given campaign seed produces reproducible mission pools, same as everything else in `core`.
- A new UI screen (`src/ui/campaign.ts`) lists available missions with briefing text and feeds into the existing `session.ts` mission-start flow.

**Touches:** `data/campaign.ts` (new), `data/missions.ts` (extend), `core/types.ts` (`CampaignState`), a new `core/campaign.ts` (pure generation/progression logic), `ui/campaign.ts` (new), `ui/session.ts` (wiring), a save/load layer (new — see open questions).

**Open questions**
- What persists between missions: unit HP/injuries, consumables, base progress? This is the save-format question the project has flagged before.
- How large does the mission pool need to be before repeats feel stale, and do supply runs scale in difficulty over the campaign?
- Is the story mission sequence linear or branching?

**Tests:** mission pool generation is deterministic for a given seed; story missions stay fixed within a run but differ between fresh playthroughs (new seed); campaign progression (locked/unlocked/completed) updates correctly; save/load round-trips campaign state.

---

## Story: the Blackout, Ashport, and the Lamplighters

**The premise.** Three years ago the regional grid cascaded and never came back — official story is a transformer chain-failure, but nobody who lived through it believes that anymore. Without power, water treatment and comms, Ashport didn't calm down, it split: every district became whoever had the guns and the fuel. The squad starts as a handful of survivors doing supply runs out of a dead substation in Riverside. What turns that into a campaign is a working theory: someone can still throw switches in this city, and the people doing it call themselves the **Lamplighters** — relighting a district is both the fictional goal and the mechanical one (hold it, clear it, keep it).

**How the mechanics carry the story.** Nothing here needs new narrative systems — it rides entirely on features already on this roadmap:
- **The squad grows because the fiction says so.** A mission that ends with "found a survivor" is a roster addition; the campaign layer (#5) is where that gets tracked, base building (#6) is where they live between missions.
- **Gear and levels are loot and progress, not a shop.** Every armor piece, weapon mod and perk (#7, #8) is scavenged or earned on a job, in keeping with "gathers gear, levels up."
- **Purpose is literally the campaign map.** Each node on the map (#5) is a district; clearing its story mission flips it from raider-held to Lamplighter-held, which is the "cleansing the home city" premise made mechanical rather than narrated.

**Three acts, one city.**
| Act | Districts | Antagonist | Shape |
|---|---|---|---|
| 1 | Riverside (home), Market Row | **the Jackals** — small-time scavenger raiders, opportunists preying on the weak, no real organization | Low-stakes, teaches the loop: clear a block, find a recruit, run a supply mission, take out the local leader |
| 2 | Dockyards, Substation Hill, Old Town | **the Cinder Wardens** — an organized militia that carved the city into fiefs, runs checkpoints and "tithes" survivor enclaves for fuel and food | Escalation: fortified positions, patrol/turret AI profiles (#0c), the ammo economy (#4) actually bites |
| 3 | Uptown, the Spire | **Halcyon Systems** (twist) — the utility/security contractor that ran Ashport's grid before the Blackout; the Cinder Wardens turn out to be its enforcement arm gone feral, and the outage that started all this was theirs to begin with | Payoff: the Wardens' command structure collapses once Halcyon is exposed, final mission is retaking the Spire (old Halcyon HQ) and handing grid control back to the districts |

None of act 2 or 3 needs detail yet — the campaign map (#5) only needs the pool/sequencing mechanism, and later sessions can slot in districts and missions the same way Act 1 does below. What matters now is that district order (Riverside -> Market Row -> Dockyards -> Substation Hill -> Old Town -> Uptown -> the Spire) gives #5's story-mission sequence something concrete to schedule.

---

## Act 1 missions: Riverside

The four story missions that open the campaign, in order. They reuse Training Grounds as the standalone tutorial/rules-sandbox (unchanged, per #0f) rather than folding it into the story — Act 1 starts fresh once a player leaves Training Grounds. Each row notes which unbuilt feature it leans on, so these are natural first content once that feature lands rather than needing everything at once.

| # | id | Name | Objective type (#3) | Beat | Needs |
|---|---|---|---|---|---|
| 1 | `lights-out` | Lights Out | Sabotage/Hold — reach the substation switch and hold it | Clear the block around the crew's dead substation, throw the switch, power the safehouse. First taste of the loop. Ends with the first recruit (a soldier who'd been holed up in the substation basement). | #2 (switch), #3 (sabotage/hold) |
| 2 | `signal-fire` | Signal Fire | Defend — hold a rooftop relay N rounds while it broadcasts | Get a relay running to find out who else is still out there; Jackals converge on the broadcast. Good fit for night/storm weather (#1) to sell "signal in the dark." Reward: a gear cache (first armor/equipment drop, #7). | #1 (weather), #3 (defend) |
| 3 | `supply-run-market-row` | Supply Run: Market Row | Reach/extract — grab marked crates and get to the exfil zone | Routine scavenging for ammo and medkits (#4); the first mission worth delegating to auto-run (#0d) once that exists, since it's low narrative stakes by design. | #4 (pickups), #0d (auto-run, optional) |
| 4 | `jackals-den` | The Jackals' Den | Eliminate (specific target) — kill or capture the Jackal leader | Act 1 finale: hit the warehouse the Jackals run their district out of, take down their leader. Clears Riverside, unlocks the campaign map onward to the Cinder Wardens in Act 2. | #3 (eliminate-specific), #5 (unlocks next district) |

**Open questions specific to these four**
- Does "found a recruit" (mission 1) hand the player a new unit immediately, or queue it for the base screen (#6) once that exists? Suggest immediate for Act 1 since base building isn't built yet — revisit once #6 lands.
- Is the Jackal leader (mission 4) a reskinned soldier with a name, or a distinct stat block? A distinct block is more memorable for an act finale but is scope the class table (`data/units.ts`) doesn't have a slot for yet (no per-unit-instance stats, only per-class) — likely needs a small "boss" affix (bonus HP or a second action) rather than a whole new class, decide when #0c's AI profiles exist to give it a "leader" behavior too.
- Map layout for these four is not built yet; they can share Riverside's tileset/palette conventions with Training Grounds but should look like a lived-in district, not the rules-exercise range.

---

## 6. Base building

**Goal:** a home-base screen with buildable/upgradeable facilities (medstation, workbench, etc.) that provide meta-progression bonuses or unlock actions between missions.

**Design sketch**
- `data/base.ts` (new): facility types, upgrade tiers, costs and effects — e.g. the medstation heals/removes injuries between missions, the workbench enables crafting or upgrading equipment (#7).
- `BaseState` (new): built facilities and their levels, persisted in the campaign save.
- A base UI screen (`ui/base.ts`, new) for construction and upgrades, spending a resource/currency earned from missions.

**Touches:** `data/base.ts` (new), `core/types.ts` (`BaseState`), a new `core/base.ts` (pure build/upgrade validation and effect application), `ui/base.ts` (new); ties into campaign save/load (#5) and into equipment (#7) if the workbench crafts gear.

**Open questions**
- What currency/resource funds base building — mission rewards, or a dedicated resource type?
- Does the medstation replace or supplement in-mission medkits (#4's consumables)?
- Is construction/upgrade time-gated (turns or missions to complete) or instant, and how many facility slots exist?

**Tests:** build/upgrade costs are validated and deducted correctly; facility effects apply correctly (e.g. medstation heals between missions); base state persists across save/load; invalid builds (insufficient resources, already max level) are rejected.

---

## 7. Unit equipment screen

**Goal:** each unit has an armor slot and two equipment slots that change its effective stats, filled from gear that's bought at base, crafted from found materials, or looted during a mission.

**Where we are:** `ClassDef` (`data/units.ts`) bakes a single flat `armor` value and full weapon stats per class; `damageAgainst` (`core/combat.ts`) reads that armor straight from `CLASSES[target.cls].armor`. `Unit` (`core/types.ts`) has no equipment fields at all. Environmental modifiers already exist as `EnvModifier` (`visionMult`/`accuracyMod`/`moveMult` in `data/weather.ts` and `data/timeOfDay.ts`, e.g. `midnight`'s vision/accuracy/move penalty) and apply uniformly to every unit — nothing today lets a specific unit resist or counter them, which is exactly what a flashlight or night-vision item needs to do.

**Design sketch**
- **Slots:** one armor slot and two equipment slots per unit — `Unit.armor: ArmorId | null` and `Unit.equipment: [EquipmentId | null, EquipmentId | null]` in `core/types.ts`.
- `data/armor.ts` (new): armor pieces, each carrying an armor value that combines with (or replaces — see open questions) the class base armor before `damageAgainst` applies it.
- `data/equipment.ts` (new): equipment pieces, several of them naturally expressed as a per-unit `EnvModifier`-shaped bonus rather than a new concept:
  - **Boots:** a flat move bonus or `moveMult`, stacking with the mission's own move modifier.
  - **Flashlight:** counters weather's `visionMult` penalty (rain, fog) specifically, leaving time-of-day untouched.
  - **Night-vision goggles:** counters time-of-day's `visionMult`/`accuracyMod` penalty at night (`midnight`) specifically, leaving weather untouched.
  - Room left for later objective-specific gear (a hacking tool for doors/terminals once #2 exists, a detector for pickups once #4 exists) — no need to design those now, just keep the item type open to it.
- **Applying it:** wherever weather's and time-of-day's `EnvModifier`s are currently combined into one multiplier (`core/vision.ts` for vision, `core/combat.ts` for accuracy), fold in the acting unit's equipped items as a third, per-unit modifier in that same combination step.
- An equip screen (`ui/`) reads owned inventory (from base/campaign state) and assigns armor/equipment per unit before a mission starts, feeding `core/state.ts` unit setup.

**Loot system** (needed to actually get equipment in a mission, per the design)
- **Chests:** once doors/interactables (#2) exist, add a `chest` interactable type — opened with `interact`, yields an item from a loot table.
- **Enemy drops:** on a `died` event for an enemy unit, roll against a loot table (through the seeded RNG) and place the result as a pickup, reusing the pickup-on-tile mechanism from consumables (#4) rather than inventing a second one.
- Both routes end up producing an ordinary pickup that enters the player's inventory the way an ammo/medkit pickup already would once #4 exists, so the loot system's only genuinely new pieces are the drop tables and the armor/equipment item types themselves — it rides on #2 and #4 rather than needing its own delivery mechanism.

**Touches:** `core/types.ts` (armor/equipment slots on `Unit`), `data/armor.ts` (new), `data/equipment.ts` (new), `data/loot.ts` (new: chest and enemy drop tables), `core/combat.ts` (armor read from the unit's slot), `core/vision.ts`/`core/combat.ts` (equipment folded into the existing weather/time-of-day combination), `core/actions.ts` (chest interact, once #2 generalizes `interact`), `core/ai.ts` (enemy death rolls a drop), `data/units.ts` (base loadouts become defaults, not fixed), `ui/` (new equip screen), `scripts/sim.ts` (a knob to test balance across loadouts).

**Open questions**
- Does an armor piece stack on top of the class's innate armor (a tank keeps its base 3 plus gear), or replace it outright?
- All three acquisition routes (buy, craft, loot) from day one, or does loot come first to bootstrap the economy before base building (#6) exists to buy/craft from?
- Is equipment a shared pool the player reassigns freely between missions, or bound to a unit once equipped, and does that decision happen anywhere or only at base?
- Do flashlight/NVG fully cancel the relevant penalty or just blunt it — a partial counter is probably easier to balance than a hard "problem solved" item.

**Tests:** an armor slot changes damage taken via `damageAgainst`; boots change effective move range; a flashlight reduces/negates weather's vision penalty but not time-of-day's, and NVG the reverse; a chest interact grants its item; an enemy death rolls a drop deterministically for a given seed and it appears as a pickup; equip state persists in the campaign save; sim balance table reflects equipment variance.

---

## 8. Unit leveling & perks

**Goal:** each class follows its own leveling path. Units earn XP from missions and from what they do during them, leveling up along that path; each significant level adds 2 new perks to that unit's perk pool, and at intervals unlocks another active-perk slot (starting at 1, capping at 3 chosen at once).

**Where we are:** `Unit` (`core/types.ts`) has no xp/level/perk fields yet, but the pieces an XP system needs already exist: per-unit `dmgDealt`/`dmgTaken`/`kills` counters (kept for the simulator), and an event log (`EventBody`/`GameEvent`) that already emits `shot` (with `hit`/`damage`), `died`, `objective`, `capture` and `heal` — everything needed to attribute XP to a specific in-mission action is already produced, it just isn't summed into anything today.

**Design sketch**
- `Unit` gains `xp`, `level`, `perkPool: PerkId[]` (perks unlocked so far) and `equippedPerks: PerkId[]` (currently active, limited by unlocked slot count).
- `data/leveling.ts` (new): a **per-class leveling path**, `Record<ClassId, LevelDef[]>`. Each `LevelDef` carries an XP threshold; **significant** levels (a subset flagged in the data, not every level) also list the **2 perks** added to that class's perk pool at that milestone, and some milestones instead (or additionally) unlock the next active-perk slot.
- `data/perks.ts` (new): the perk definitions referenced by the leveling paths, one list per class, each perk a data-driven stat/rule modifier in the same style as `EnvModifier` (bonus accuracy, extra move, cheaper gadget cooldown, and so on).
- **Slots vs. pool:** unlocking a perk (pool) and choosing to run it (equipped, up to the current slot count) are separate — a unit can bank more perks than it can currently use, and the player picks which unlocked perks fill the available slots.
- **XP sources:** a post-mission summary (objective completed, survived) plus per-action XP attributed from the existing event stream as it happens — a hit or kill credits the attacker (`shot`/`died`), objective progress credits whoever advanced it (`objective`/`capture`), a heal credits the medic (`heal`). A new `core/leveling.ts` turns those events into XP deltas per unit rather than inventing a parallel tracking mechanism.
- Perk effects apply wherever the relevant stat already lives (`core/combat.ts` for accuracy/damage perks, `core/vision.ts` for vision perks, `core/actions.ts` for cost/cooldown perks) — the same pattern `EnvModifier` already uses, just keyed by unit instead of by mission.

**Touches:** `core/types.ts` (`xp`/`level`/`perkPool`/`equippedPerks` on `Unit`), `data/leveling.ts` (new: per-class paths, milestone perk and slot unlocks), `data/perks.ts` (new: per-class perk definitions), `core/leveling.ts` (new: XP accrual from events, level-up resolution), `core/combat.ts`/`core/vision.ts`/`core/actions.ts` (wherever a given perk's modifier applies), `ui/` (level-up/perk-pick screen for choosing which unlocked perks to equip), `scripts/sim.ts` (a knob for perk builds and levels).

**Open questions**
- Exact XP amounts per action (kill vs. hit vs. objective step) and per-class thresholds for "significant" levels are balance work, best tuned via `scripts/sim.ts` once the shape exists rather than guessed up front.
- Is equipping/swapping unlocked perks free between missions (respec anytime), while pool unlocks stay permanent — or does equipping also lock in once chosen?
- Do perks stack with equipment (#7) bonuses in ways that need capping (e.g. a move perk plus boots)?
- Does a unit lost mid-campaign lose its levels and perk pool permanently, sharpening the permadeath stakes, or is progress banked some other way?

**Tests:** XP accrues correctly from each event type (hit, kill, objective, heal) and from the post-mission summary; level-up fires at the correct per-class thresholds; a significant level adds exactly 2 perks to that unit's pool; a slot-unlock milestone increases equippable count and never exceeds the cap of 3; equipping is limited to unlocked perks and the current slot count; perk effects apply correctly to their relevant calculation; levels, perk pool and equipped perks persist in the campaign save; sim reflects perk-driven balance shifts.

---

## After these: levels, campaign, multiplayer

Not planned in detail yet. These notes record what still needs attention beyond the meta-game layer above.

**Levels and campaign**
- See the Meta-game layer section above for base building, equipment, leveling and the campaign map.
- The map builder becomes a real level editor once the campaign map exists (multiple maps, per-map objective and weather settings, validation).

**Multiplayer (PvP and co-op)**
- The design already helps: the rules core is pure and deterministic, all actions go through `validate` / `perform`, and fog and memory are tracked **per team**. That fits either a server-authoritative model or lockstep (each client replays the same action list from the same seed).
- Things in today's code that assume one human against the AI: `Team` is `'player' | 'enemy'` and the AI always drives `'enemy'`; `GameEvent.seen` is computed for the player team only, so PvP needs per-team visibility of events (or filtering on the server); `Session` assumes one local human. PvP means a human on both sides; co-op means several humans on one team, so decide simultaneous versus alternating phases and add timers.
- Hidden information (the other team's `memory`, RNG state) must never be sent to the client that should not have it.
- Objectives that can be completed by either side (see #3) are the hook for asymmetric PvP scenarios.
