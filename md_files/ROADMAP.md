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
| 9 | Visual rehaul (real art for units, items, tiles, base building, etc.) | large | 2-8 ideally done first, so meta-game screens (5-8) get first-pass art instead of a second pass |

0a-0f go first: they are core game-feel, not content, and every feature after them (new hazards, objectives, pickups, mission generation) needs the clearer UI, the revive mechanic, a more capable AI, configurable controls and a way to teach all of it already in place instead of retrofitted later. 0d builds directly on 0c's AI rework, and 0f is easiest last among these since it can then cover 0b-0e as well as the base rules, so do them in roughly that order even though most of them can start immediately. Weather can slot in any time after that. 2 -> 3 -> 4 is the order that avoids rework: objectives like "sabotage 3 terminals" need interactables, and "retrieve the case" needs pickups.

5-8 are the meta-game layer: base -> equip/level the squad -> pick a mission from the campaign map -> play it -> return to base. Unlike 1-4 (each buildable and testable against the single Training Grounds mission), these need at least a minimal second mission and a persistent save file to test end-to-end, so they naturally come after.

9 goes last on purpose: it's presentation over everything else on this list, and drawing something properly once (after its final shape is known) beats re-skinning it repeatedly as 2-8 change what needs to be on screen.

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

**Status: done.**

**Goal:** the player can hand a low-stakes mission, such as a supply run, to AI control of their own squad instead of playing every turn manually.

**Where we are:** `data/aiProfiles.ts` gained a `friendly` profile (habitat `patrol`, `retreatBelowHp: 0.5` - more cautious than `hard`'s 0.3 - and a new `prioritizeObjective: true`). `prioritizeObjective` (`core/ai.ts`'s `pickGoal`) makes a `patrol`-habitat unit head for a *seen* objective ahead of chasing a spotted ghost, i.e. finishing the mission over finishing a fight it doesn't have to. Nothing else about `planAction`/`evaluate` needed to change: it was already parametrized purely by `u.team` throughout (fog reads, goal-seeking, everything), so pointing it at `'player'` with the `friendly` profile was a data change, not new logic - which is exactly what made the fog-fairness test below trivial to satisfy rather than something to bolt on.

`ui/session.ts`'s `Session.autoRun` (toggled by `toggleAutoRun()`, key `P`, HUD button `#auto-run-toggle`) sets `s.aiProfiles.player = 'friendly'` and, once it's genuinely the player's own idle turn, calls a new `runPlayerAuto()` - a straight mirror of the existing enemy-phase stepped-generator loop in `endTurn()` (same `runId`-guarded `setTimeout` shape, just `aiTurn(s, 'player')` instead of `'enemy'`). `finishEnemyPhase()` now calls `runPlayerAuto()` when `autoRun` is set, and `runPlayerAuto()` chains back into `endTurn()` when its own phase completes - so once toggled on, it keeps looping player-phase -> enemy-phase -> player-phase until the mission ends, a casualty hands control back, or the player toggles it off. While it's running, `busy` is true, which already disables every manual action button and canvas click through the existing `ready` guard - no new input-blocking logic needed.

**Resolved**
- Auto-run is available on any mission for now, not gated to specific templates - there's no campaign layer (#5) yet to mark templates auto-runnable, and gating it centrally can be added later without touching this feature's own logic.
- Not full permadeath-with-no-safety-margin, but not a hard floor either: `retreatBelowHp: 0.5` gives the friendly AI real self-preservation instinct, and a casualty (any player unit going down or dying) immediately hands control back rather than letting the AI play through a loss unsupervised - see below.
- The player can interrupt an in-progress auto-run at any time via the same toggle (button or `P`), not just between missions. It takes effect at the next phase boundary rather than instantly mid-unit-turn (the current phase's already-queued actions finish playing out - there's no clean way to abort mid-action without leaving a unit in a half-resolved state), and it also triggers itself automatically the moment a player unit takes a casualty during an auto-played phase, with a log line explaining why control came back.
- No dedicated mission-results-summary screen (casualties/loot/objective outcome) - loot doesn't exist yet (#4/#7) to summarize, and the existing combat log (already populated from the same events a manual phase produces) plus the existing win/loss banner plus the new "Auto-run stopped: a unit went down" log line cover what a v1 needs. Revisit once loot exists and there's an actual reason to interrupt the player with a modal instead of leaving it in the log.

**Tests:** `core/aiProfiles.test.ts`'s new "friendly profile" block - the profile's own shape (patrol, `prioritizeObjective`, a higher retreat threshold than `hard`); it heads for a seen objective ahead of a closer spotted ghost; a friendly-controlled player unit never reacts to an enemy it hasn't seen (the same fog-fairness check `ai.test.ts` already runs for the enemy team, just with `team: 'player'`); and a determinism check (same seed, same combat-RNG-consuming outcome, twice) mirroring `ai.test.ts`'s existing `playMatch` determinism test. `Session.autoRun`'s timer-driven chaining (toggle on, watch it play through several phases, toggle off, confirm the flag and button state) was verified live in a driven headless browser rather than with fake timers - no prior test in this codebase exercises `setTimeout`-chained UI flows, and the underlying AI logic it chains together is already covered at the core level above.

---

## 0e. Hotkey settings

**Status: done.**

**Goal:** the player can see and rebind every keyboard shortcut instead of living with a fixed layout.

**Where we are:** `ui/keybindings.ts` (new) defines `BindableAction` (every `ButtonId` plus `toggleOverwatchView`, `toggleAutoRun`, `rotateCoverCW`, and `selectUnit1`-`selectUnit5`), `DEFAULT_BINDINGS` (reproduces the old hard-coded `KEYS` map and inline checks exactly), and pure `loadBindings`/`saveBindings` (`localStorage`, gracefully falling back to defaults if storage is corrupt or unavailable - never throws). `ui/input.ts` now owns the live `KeyBindings` instance and exposes `getBindings`/`keyFor`/`actionUsing`/`rebindAction`/`resetBindings`; `bindInput`'s keydown handler looks the pressed key up in the live bindings instead of the old hard-coded map, so every shortcut is rebindable, not just the ones already routed through `KEYS`. A new settings screen (`ui/settings.ts`, reachable from a "Settings" button on the home screen and in the game topbar, remembers which to return to) lists every binding with a click-then-press-a-key rebind control, inline conflict/reserved-key messages, and a reset-to-defaults button. `ui/hud.ts`'s action bar and button tooltips now read the live binding (`keyFor`/`displayKey`) instead of a hard-coded key label, so they stay correct automatically after a rebind - the 0a tie-in the design sketch called for.

**Resolved**
- Keyboard only for v1, not mouse-bound actions (right-click-to-cancel stays fixed) - the settings screen and capture flow are keyboard-specific; rebinding a mouse button would need a different capture UI, not just a different key string.
- One set of rebindable defaults, no named presets (e.g. left-handed) - nothing stops a player from just rebinding everything themselves, and a curated preset can be added later as a second `KeyBindings` constant without touching the rebinding mechanism itself.
- `Escape` (cancel) is reserved and hard-coded, never in `BindableAction`/`DEFAULT_BINDINGS` at all - both `bindInput` and the settings screen's rebind-capture treat it specially (always cancels; during a capture, aborts the rebind instead of being assignable), so a player can never lock themselves out of canceling.
- One deliberate behavioural change from the old fixed layout: `Enter` no longer also triggers End Turn alongside `E`. The old `KEYS` map bound two raw keys to one action; the new model is one key per `BindableAction`. Keeping a hidden second hard-coded key for exactly one action would be inconsistent with "every shortcut is rebindable, and the settings screen shows the whole truth" - a player who wants `Enter` back can just rebind End Turn to it.
- Rotating cover the other way (`Shift+Q` today) is not an independently bindable action - it's always Shift + whatever `rotateCoverCW` is bound to, avoiding the complexity of encoding modifier combinations as distinct rebindable key strings for a single, minor, paired action.

**Tests:** `ui/keybindings.test.ts` - defaults cover every action with distinct, non-reserved keys; `loadBindings` returns defaults with nothing saved, round-trips after `saveBindings`, falls back cleanly on corrupt JSON or a missing `localStorage`, and fills in any action missing from an old save from defaults; `keyOf`/`displayKey` normalization. `ui/input.test.ts` - rebinding succeeds and is reflected by `keyFor`/`getBindings`; the reserved key and an already-used key are both refused (the latter naming the conflicting action) while the binding stays unchanged; rebinding an action to the key it already has is a no-op, not a self-conflict; freeing a key by moving it lets another action take it; `resetBindings` restores every default. The settings screen itself (rebind capture, conflict/reserved messaging, reset, and the action bar picking up a rebind live) was verified in a driven headless browser.

---

## 0f. Tutorial: walk through every mechanic and action

**Status: done.**

**Goal:** a new player learns the rules and every action by playing a guided first mission, instead of guessing from the HUD or reading the code.

**Where we are:** `data/tutorial.ts` (new) lists 13 steps (`{ id, trigger, prompt, highlight? }`) covering move, attack, reload, overwatch, gadget, interact, end turn, selecting a unit, and info-only callouts for fog, revive (0b), and settings/auto-run (0d-0e). `ui/tutorial.ts`'s `Tutorial` class walks them: a step with a `trigger` advances the moment the player genuinely performs that action anywhere on the map, in any order (`stepSatisfied`, a pure function factored out specifically so the sequencing logic is unit-testable without a DOM); a step with no trigger waits for an explicit "Next" click. It never blocks or gates real play - the player can do anything at any time, the overlay just tracks along.

`Session.lastAction` (set only by manually-performed actions via `Session.try()`, never by an AI turn) is what `stepSatisfied` reads for non-select triggers; `main.ts` chains `tutorial.onSessionChange()` before `hud.update()` in `session.onChange` so a step that just advanced is already reflected in that same render. The step prompt and progress live in a new `#tutorial-box` panel (topbar area, styled like the rest of the HUD); a highlighted button gets a pulsing accent outline via `Hud`'s own actionbar render reading `tutorial.currentHighlight` - deliberately *not* the `Tutorial` class touching the action-bar DOM directly, since the action bar's buttons are rebuilt (`innerHTML`) on every `Hud.update()`, which would otherwise silently wipe out a class added there the next time anything else changed (the same class of bug 0a's tooltip work hit with hover state, caught here by testing live in a browser before committing rather than just typechecking).

Auto-starts once, the first time a player enters Training Grounds (dismissal persisted in `localStorage`, gracefully no-op if unavailable); replayable anytime after via a "Tutorial" button in the topbar, shown only on the mission it covers. "Skip tutorial" dismisses it for good (same as finishing it normally); leaving to a different mission mid-tutorial just hides the overlay without marking it dismissed, so it still offers to auto-start next time Training Grounds itself is entered.

**Resolved**
- Reuses Training Grounds rather than a purpose-built map - it already is the "exercises every rule" map (see `ASSUMPTIONS.md`), and a second map built solely for onboarding would duplicate content for no real gain in this version.
- Non-blocking: runs alongside normal play as an optional overlay a player can ignore, skip, or race ahead of. Blocking felt actively hostile to a player who's already played tactics games before, and "wait for the real action, whenever it happens" needed no more machinery than "block until it happens" would have.
- Fog/AI coverage is one info-only step (darkened tiles, bush spotting range) rather than a deep dive - fog is explained *contextually* far better by 0a's hover danger flags, exposed-in-bush markers, and cover tooltips (all already in place) than by a tutorial paragraph could manage; the step just tells the player those signals exist and to watch for them.
- Reused 0a's infrastructure in spirit (shared visual language, `BUTTON_INFO`-consistent framing) rather than literally forcing the mouse-driven hover tooltip to display for a highlighted button - that mechanism is inherently hover/focus-triggered and doing anything else with it would have meant fighting its own event model instead of reusing it. A dedicated, simple overlay reusing the same design language was less code and less risk for the same player-facing effect.

**Tests:** `data/tutorial.test.ts` - step data validates (unique ids, every trigger is a real action type or `select`/`null`, every `highlight` names a real button, every core action is covered at least once). `ui/tutorial.test.ts` - `stepSatisfied` fires correctly for a matching action, never for an info-only step, and only on a *genuinely new* selection for `select`; a scripted playthrough in the steps' own trigger order reaches the end; an out-of-order/wrong action does not advance. The DOM-driven pieces (auto-start on first entry, the highlight actually appearing on the right button and following it correctly across a real advance, Skip/Next/replay, and the dismissed-flag persisting across a return visit) were verified end-to-end in a driven headless browser rather than with jsdom, consistent with how this codebase treats DOM-coupled UI elsewhere (`Session` has no DOM dependency and is unit-tested directly; `Hud` does and isn't).

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

**Status: done.**

**Goal:** map pieces the units can operate, so the level layout changes during play.

**Where we are:** v1 scope is doors and switches only (windows, destructible barricades, explosive barrels and retractable cover are deliberately deferred - see Resolved). `data/trainingGrounds.ts` defines the author-time shape: `InteractableType = 'door' | 'switch'` and `InteractableDef { id, type, x, y, active?, links? }`, carried on `MapDef.interactables` alongside `rows`/`spawns` - the character grid keeps the static terrain (a door/switch sits on a plain floor tile underneath it), the list carries the stateful pieces, and a switch's `links` is how it wires to the doors it toggles. `core/types.ts` mirrors this at runtime as `Interactable` on `GameState.interactables`, plus `Memory.doors: Record<id, boolean>` for fog and two new `EventBody` variants (`door`, `switch`).

`core/grid.ts`'s `closedDoorAt` is the one real refactor the design sketch called for: `blocksMove` and `blocksLos` both OR it in, so every consumer that already routes through them - `reachable`, `distanceMap`, `hasLos`, pathfinding - treats a closed door as an obstacle automatically, with zero changes needed in `core/ai.ts` itself. `core/actions.ts`'s `interact` action generalised exactly as sketched: `{ type: 'interact', unit, target? }` where an omitted target keeps the legacy objective behaviour and a target id resolves to `doInteractable`, which toggles the interactable's own `active` and, for a switch, flips every door in its `links`. It costs 1 action like every other non-move action, which means it automatically gets overwatch-triggering and bush-exposure handling for free from `perform`'s existing post-action pipeline - no interactable-specific wiring needed there. `core/vision.ts`'s `updateMemory` records each visible interactable's `active` state into `mem.doors` every refresh, the same fog treatment as everything else. `core/mapFormat.ts` validates a map's `interactables` on import (unique ids, known type, on an open unoccupied tile, no two interactables sharing a tile, a switch's `links` only pointing at real doors) and round-trips them through `serializeMap`.

The player-facing side: the `interact` HUD button now offers every legal target at once - the objective (if adjacent) and any adjacent door/switch. Exactly one candidate fires immediately (`Session.interactTargets`), same UX as the existing aid/revive disambiguation; more than one enters a new `interact` mode that highlights the valid tiles (reusing the gadget-aim highlight machinery) and lets the player click one. `ui/session.ts`'s `hoverInfo` reports a door's open/closed state or a switch's on/off state and linked-door count, fog-aware (falling back to the last-remembered state, marked stale, when the tile isn't currently visible) - the same pattern as every other hover tooltip. `render/renderer.ts` draws a closed door as a solid block with a handle, an open one as an outline frame with a swung-open leaf, and a switch as a housing with a lever that moves position on/off; both respect fog (greyed out from memory when not currently visible, hidden entirely if never seen). The map builder (`ui/builder.ts`) gained Door and Switch placement tools (paint/erase/toggle like the existing terrain tools) and a Link tool: click a switch, then a door, to link or unlink them, with a warning in the Checks panel for a switch with no linked doors. All of this was verified end-to-end in a driven headless browser: placing and linking a door/switch in the builder, then play-testing and opening the door in-game via the Interact button, which rendered correctly, cost the expected action, logged "opens the door", and revealed newly-visible tiles beyond it.

**Resolved**
- Free versus action-cost opening: action-cost, like every other non-move action - matches the design sketch's stated default and keeps overwatch-triggering consistent and unsurprising.
- Can units close doors again: yes, `interact` on a door is a toggle, not one-way.
- Does a door block a unit standing in the doorway: yes, a closed door occupies its tile in `blocksMove` exactly like a wall, so nothing can stand or path through it while shut.
- Noise/alerting: no, not in v1 - nothing in the codebase currently models sound, and adding it just for doors would be a disproportionate first step.
- One-way or timed doors: no, not in v1 - every door is a plain, player-toggleable open/closed switch.
- Windows, destructible barricades/walls, explosive barrels, retractable cover: deferred past v1. They all need a "destructible" or "windowed" obstacle model this codebase doesn't have yet (grenades currently only affect units and cover tiles, never terrain/interactables - see below), and doors alone already exercise the full fog/AI/action/builder pipeline this feature needed to prove out.
- Grenade/cover-gadget behaviour on doors: doors are not destructible or force-openable in v1 - `blast` (the grenade's core logic) only ever touches units and cover tiles, so a grenade centered on a door tile passes through it untouched. This is a deliberate scope line, not an oversight: making doors blastable is exactly the "destructible" model deferred above.
- AI and closed doors: the AI gets obstacle-avoidance for free (see `closedDoorAt` above) but does not open doors itself in v1, matching the design sketch's own "treat as an obstacle at first (simple)" phrasing. Passable-with-a-cost AI pathing through doors is left for later, once there's a reason (an AI-controlled squad, or "friendly" auto-run units, actually needing to route through one).

**Tests:** `core/interactables.test.ts` (new) - a closed door blocks both movement (`findPath`) and LOS (`hasLos`) in a corridor where it's the only way through, an open one blocks neither; opening a door costs 1 of 2 actions and triggers a genuine enemy overwatch reaction shot; a switch toggles every door in its `links` and toggles them back; the enemy AI, given a search waypoint on the far side of a closed door it cannot see through, holds position/overwatch instead of ever crossing it; a door's last-seen state survives in `memory.doors` while out of sight and updates again once re-seen; a grenade centered directly on a door tile leaves it untouched. `core/mapFormat.test.ts` - serialize/parse round-trips an interactable list including `links`; rejects an unknown type, an off-tile position, a duplicate id, a tile shared with a unit spawn or another interactable, and a switch linking to a non-door id; a builder-style `withEdits` → `serializeMap` → `parseMap` round trip preserves the list. The map builder's new tools (placement, erase-by-repainting, the link tool's select-switch-then-select-door flow, and the Checks panel's unlinked-switch warning) and the in-game Interact flow (button disambiguation, hover tooltip, opening a door and seeing the newly-revealed tiles) were verified in a driven headless browser rather than unit tests, consistent with how this codebase treats DOM-coupled UI elsewhere.

---

## 3. Different objective types

**Status: done** (four types shipped - hold, eliminateTarget, sabotage, reach; defend/escort/retrieve/survive deferred, see Resolved).

**Goal:** missions that are not all "interact and hold". Objectives become data, so each level can pick its own.

**Where we are:** `data/objectives.ts` (new) defines `ObjectiveType = 'hold' | 'eliminateTarget' | 'sabotage' | 'reach'` and one interface per type (`HoldObjectiveDef`, `EliminateTargetObjectiveDef`, `SabotageObjectiveDef`, `ReachObjectiveDef`), unioned as `ObjectiveDef`. `MapDef.objective?: ObjectiveDef` (`data/trainingGrounds.ts`) is optional, authored directly in a mission's TS map literal the same way `enemyProfile`/`startWeather` already are (not builder-editable JSON - see Resolved); undefined means the legacy default (hold the map's single `O` tile if it has one, else no primary objective at all - just the always-on team-wipeout win/loss that was already unconditional in `checkWin`). `core/objectives.ts` (new) holds the pure logic every type needs: `objectiveComplete` (the win check for the three new types - hold still wins through the existing `capture`/`tickCapture` round-counter in `core/state.ts`, untouched), `objectiveGoalPositions` (the AI goal hint each type owes its side, fog-fair - reads only what `s.memory[team]` has actually earned), and `describeObjective` (the HUD line, generated from the definition instead of a hard-coded string per mission).

`GameState` gained `objectiveZone: Pos[]` (every `O` tile - one for hold, potentially several for reach) alongside the existing single `objective: Pos | null` (kept as-is: the first/only `O` tile, still what hold's own interact-then-capture flow targets) and `objectiveDef: ObjectiveDef | null` (resolved once in `createGame`). Four small generalizations fell out of making the old hold-only code paths type-aware instead of ripping them out:
- `core/grid.ts`'s `blocksMove` only treats the `O` tile as a solid obstacle (the physical terminal a unit stands *next to*) when `objectiveDef.type === 'hold'` - a `reach` mission's zone tiles are ordinary open floor a unit is meant to stand on.
- `core/actions.ts`'s `interactBlock` (the objective-only branch of the generalized `interact` action from #2) now requires `objectiveDef.type === 'hold'`, so the "interact with the objective" affordance simply isn't offered on a non-hold mission; the cover gadget's same "don't build on the terminal" check is gated the same way.
- `core/vision.ts`'s `objectiveSeen` memory flag is now set by *any* zone tile becoming visible, not just the single one - transparent for hold (one-element zone), needed for reach's multi-tile zones and a sabotage/eliminateTarget mission's own AI goal-seeking (below).
- `core/mapFormat.ts`'s "at most one objective tile" import validation is relaxed to "at least one" specifically when the map's declared type is `reach` (a multi-tile zone); every other type (including the undefined/legacy default) keeps the original at-most-one rule.

`core/ai.ts`'s `pickGoal` no longer reads `s.objective` directly - it calls `objectiveGoalPositions(s, team)` and heads for the nearest result, which is a hold/reach zone tile once `memory.objectiveSeen`, or a sabotage mission's *seen* listed interactables (via the existing `memory.doors` fog record from #2), or nothing for `eliminateTarget` (no positional goal - the AI just fights normally, and the target unit dying however it happens ends the mission). This is behavior-preserving by construction for every existing hold-type test (`objectiveGoalPositions` returns exactly `[s.objective]` under the same `objectiveSeen` gate the old code checked) while automatically extending camper's "defend what it's seen" and the `friendly`/`prioritizeObjective` habit to the new types for free.

`ui/hud.ts`'s `objectiveText()` now just calls `describeObjective(s)` for anything but hold's own live "SECURING: N rounds - <unit> must stay put" line (kept local since it needs `nameOf`, a UI-layer display-name concern core doesn't touch). `render/renderer.ts`'s `drawObjective` draws a marker per `objectiveZone` tile instead of a single one (visually identical for hold, since that zone still has exactly one tile); `eliminateTarget`/`sabotage` have no zone tiles to mark and get no special sprite yet (see Resolved). `core/sim.ts`'s existing `via: 'objective'` classification (win + the loser still has living units) already covered every new type for free - it infers "how," it doesn't special-case hold.

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

**Touches:** `data/objectives.ts` (new), `core/objectives.ts` (new), `core/state.ts`, `core/actions.ts`, `core/grid.ts`, `core/vision.ts`, `core/mapFormat.ts`, `core/ai.ts`, `core/testkit.ts` (`makeGame` gained an optional 5th `objective` param), `ui/hud.ts`, `render/renderer.ts`, `data/trainingGrounds.ts` (`MapDef.objective`).

**Resolved**
- Which team(s) can complete an objective: kept `RULES.objectiveCapture`/`GameOptions.objectiveCapture` (`player | both | none`) exactly as-is, but scoped to `hold` specifically, since that's the only type it ever governed. The three new types are player-only for v1 - no mission has an AI-pursued objective yet (the enemy just fights and idles per its habitat), and per-objective team ownership is real complexity worth deferring to whenever PvP or an enemy-side objective actually needs it, same open question the design sketch itself flagged as "the natural hook for PvP later."
- Secondary objectives: not in v1 - every mission has exactly one primary `MapDef.objective` slot. Nothing here blocks adding a `secondary?: ObjectiveDef[]` list later; it just isn't needed until a real mission (#5's campaign layer) wants one, and building it against zero real use cases would be guessing at the shape.
- Objective state in `GameState`: `objectiveDef` (the definition) plus the type-specific runtime bits already on `GameState` (`capture` for hold, `interactables[].active` for sabotage, unit position for reach, unit `.alive` for eliminateTarget) turned out not to need a separate unified "objective state" bucket - each type's progress is either already-existing state or trivially recomputed live in `objectiveComplete`/`describeObjective` rather than tracked incrementally, so there's nothing to serialize that isn't already part of the normal save shape once saves exist (#5).
- Scope cut from the design sketch's candidate list: shipped `hold` (already existed), `eliminateTarget`, `sabotage`, `reach`. Deferred: `defend` (keep a point/unit alive N rounds - needs a turn-limit/fail-condition concept this codebase doesn't have yet, since every current objective is win-only with no separate fail clock), `escort` (needs a controllable-but-not-player-owned VIP unit - a third "team" concept), `retrieve` (explicitly needs #4's pickups), `survive` (needs wave-spawning mid-mission, which nothing in `core/state.ts` supports - missions are fixed-spawn today). None of the four shipped types needed anything not already on the roadmap or already built by #2; the other four each need at least one more building block first, so building them now would mean guessing at that block's shape instead of using it. Optional turn limits on any type: also deferred alongside `defend`, same missing-fail-clock reason.
- The map builder was **not** given objective-authoring tools. `MapDef.objective` sits at the same authoring tier as `enemyProfile`/`startWeather` - hand-written TS on the mission's map literal, not part of the builder's JSON rows/spawns/interactables format - and the builder already doesn't expose those either. The builder's existing single-objective-tile warning and reachability check are untouched and still correct for hold-type (and harmless, if imprecise, for a reach map's first zone tile); real objective authoring is a #5 campaign-data-tooling concern once missions beyond Training Grounds actually exist.
- No sim knob added for the three new types (the "ground rules" checklist item): `scripts/sim.ts`'s existing `--objective` flag already covers hold's own capture-rule knob (`objectiveCapture`), and no shipped mission uses `eliminateTarget`/`sabotage`/`reach` yet to have a balance question worth measuring - Training Grounds stays hold-type. Revisit once #5 ships a mission using one of them.
- No distinct visual marker for `eliminateTarget` (a highlighted target sprite) or a differently-themed zone tile for `reach` (an extraction pad instead of reusing the hold terminal's console graphic) - both are presentation work with no mechanical stakes, explicitly deferred to #9 (visual rehaul), which is where every placeholder sprite in this codebase is meant to get its real pass, once, rather than being re-skinned piecemeal as more objective types are added.

**Tests:** `core/objectives.test.ts` (new, 10 tests) - `eliminateTarget` wins the instant the named unit dies regardless of its squad, does not win while that unit is merely downed (0b), and the always-on full-wipeout path still wins independently of the named target; `sabotage` wins only once every listed interactable is active (not just one of several), and ignores an interactable that isn't on its list; `reach` wins once enough *living, non-downed* player units are simultaneously in the zone (a downed occupant doesn't count), and confirms a zone tile is walkable open floor rather than a blocked obstacle like the hold terminal; two AI-goal-hint tests confirm a camper habitat defends a sabotage terminal it has seen and never heads for one it hasn't (fog-fair, via the existing `memory.doors` record from #2). `core/mapFormat.test.ts` gained three tests for the relaxed objective-tile-count rule (a reach mission rejects zero tiles, accepts more than one, and every other type - including the default - still rejects a second one). Three pre-existing `core/aiProfiles.test.ts` tests that poked `s.objective` directly (bypassing map parsing, a pre-existing shortcut for tests with no `O` tile in their hand-built map) needed a one-line update to also set `objectiveZone`/`objectiveDef`, since goal-seeking now reads those instead of the bare position - not a behavior change, just the tests' own setup catching up to the new source of truth (`setObjective` helper added to that file). HUD text generation and the terminal-marker rendering were additionally checked live in a driven headless browser (both the "not yet spotted" and "found" hold-mission phrasings render correctly with no console errors); the full existing suite (192 tests, unrelated to this feature) stayed green throughout, confirming hold-type missions are unaffected.

---

## 4. Consumables on the map, and an ammo economy

**Status: done.**

**Goal:** loot and resource pressure. Units find items on the map, and ammo stops being unlimited.

**Where we are:** `data/units.ts`'s `ClassDef` gained a per-class `reserve` (sniper 6, assault 12, soldier/medic 18, tank 12 - placeholder numbers, see Balance below), and `Unit` (`core/types.ts`) carries it at runtime alongside `ammo`. `core/actions.ts`'s `reload` action now draws from it instead of refilling for free: `draw = min(magazine - ammo, reserve)`, so a low reserve gives a genuine partial refill rather than an all-or-nothing swap; `validate()`'s reload case returns `'No reserve ammo'` once it's empty, on top of the pre-existing `'Magazine full'` check. `data/items.ts` (new) defines `ItemType = 'ammo' | 'medkit' | 'gadget'` and each type's display name/blurb/default amount; `MapDef.pickups?: PickupDef[]` (`data/trainingGrounds.ts`) seeds `GameState.pickups: Pickup[]` at `createGame`. A unit collects whatever's on its tile for free by walking onto it - `core/actions.ts`'s new `collectPickup`, called from every step of `doMove`'s existing per-tile walk loop (the same loop that already triggers overwatch and bush-exposure per step), so a pickup is grabbed the instant a unit's path crosses its tile, not just on the final destination. Ammo adds to `reserve` (not `ammo` directly - it refills the "backpack", a further reload still spends the action to chamber it), medkit adds to `medkits`, gadget adds a use to whichever gadget the picking-up unit's own class carries; any unit of either team can collect any pickup (no team restriction, matching "the AI can use them too"). A new `pickup` event feeds the log (`ui/log.ts`).

Fog: unlike a door's state (2), a pickup has no persistent state worth remembering while out of sight - it's either still there or already gone (possibly collected by someone off-screen), so `render/renderer.ts`'s `drawPickups` and `ui/session.ts`'s hover tooltip both draw it purely from current visibility (`s.visible.player`), with no memory record at all; this is a deliberate simplification from doors' full remembered-state model, spelled out below. `core/ai.ts` needed two small changes: `planAction`'s existing "reload if empty" check (`ok(s, reload)`) already goes through the same `validate()` reload gate, so "the AI reloads only if reserve remains" fell out for free with no new code; a genuinely dry unit (`ammo === 0 && reserve === 0`) with no visible enemy now heads for the nearest *visible* ammo pickup instead of idling per its habitat (mirroring the existing downed-ally-chase block's shape); and the attack branch (`if (here) return {type:'attack',...}`) is now gated on `u.ammo > 0`, since `evaluate()` scores a tile by potential damage without checking ammo at all - without the guard, a dry unit with an otherwise-good shot would try and fail an invalid attack action and end its turn doing nothing, a latent gap this feature's own new "reserve can hit zero mid-fight" scenario made worth closing.

The map builder (`ui/builder.ts`) gained three pickup tools (Ammo/Medkit/Gadget pickup, one per type rather than one tool plus a dropdown, matching the Door/Switch precedent) with the same paint/erase-by-repainting behavior as every other builder tool, and blocks placement on a tile already holding a unit or a door/switch (and vice versa). `core/mapFormat.ts` validates an imported pickup list the same way it validates interactables (unique ids, known type, open unoccupied tile, positive integer `amount` if given) and round-trips it through `serializeMap`/`withEdits`.

**Design sketch**
- **Pickups:** items lying on tiles: ammo crate, medkit, grenade / gadget charge, stimulant, and later special ammo. A unit picks one up by walking onto the tile (free) or by an interact action; decide by feel. Pickups are hidden by fog until seen, and the AI can use them too.
- **Ammo economy:** give each unit a finite **reserve** (`reserve` per class in `data/units.ts`). Reload draws from it; empty reserve means no reload. Ammo crates refill reserve. Later options: adjacent units can hand over ammo (an action), special ammo types (armor-piercing, for example).
- Pressure points to think about: the Assault burst uses 1 ammo per attack (the current rule), so a small reserve punishes bursts less than expected; the Sniper has a 3-round magazine, so reserve size matters most there.
- `Unit` gets `reserve` (and possibly an inventory). New events (`pickup`, `ammoLow`) feed the log and floating text. The HUD shows reserve next to the magazine.
- Enemy AI: reload only if reserve remains; when out of ammo, seek visible pickups; consider enemy drops on death (loot for the player) as a later reward loop.

**Balance:** `Unit` gained `reserveUsed` (total rounds ever drawn from reserve by reloads) and `ranDry` (sticky: true once a unit has ever had both `ammo` and `reserve` at 0 simultaneously) alongside the existing simulator stats (`dmgDealt`, `kills`, etc.). `core/sim.ts`'s `UnitResult` and `scripts/sim.ts`'s per-class table both carry them through; a 300-match run at the default reserve sizes shows most classes never running dry on Training Grounds' short fights (avg. 8.3 turns), with the sniper's tight 3-round magazine the most exposed (~8%) - matching the design sketch's own prediction that reserve size matters most there. A new `--reserve-mult` sim flag (backed by `GameOptions.reserveMult` / `MapDef.reserveMult`, the same override-chain pattern as weather/enemy profile) scales every unit's starting reserve for A/B testing; at `0.2` the sniper's ran-dry rate jumps to ~95% and average match length roughly doubles (19.7 turns, mostly timeouts) - confirming the knob has real, measurable effect on outcomes, not just a cosmetic number.

**Touches:** `data/units.ts` (`ClassDef.reserve`), new `data/items.ts`, `data/trainingGrounds.ts` (`MapDef.pickups`, `MapDef.reserveMult`), `core/types.ts` (`Unit.reserve`/`reserveUsed`/`ranDry`, `Pickup`, `GameState.pickups`, `GameOptions.reserveMult`), `core/actions.ts` (reload, `collectPickup`), `core/ai.ts`, `core/mapFormat.ts`, `core/testkit.ts`, `core/sim.ts`, `ui/builder.ts` (three pickup tools), `ui/hud.ts`, `ui/session.ts` (hover), `ui/log.ts`, `render/renderer.ts`, `scripts/sim.ts`.

**Resolved**
- Pickup mechanic: walking onto the tile, free (no action cost) - simpler than an interact action, and matches "decide by feel" from the design sketch's own open framing. Collected mid-path, not just on the final destination tile, via the same per-step walk loop that already handles overwatch triggering.
- Ammo scarcity per mission: `MapDef.reserveMult` / `GameOptions.reserveMult`, resolving the open question exactly as it suggested - a per-mission multiplier rather than a global constant, with a matching `--reserve-mult` sim flag. Training Grounds itself stays unscaled (`1`, the default) - it's the tutorial/rules-sandbox map, not the place to make ammo bite.
- Pickups are spawn-fixed by the map (`MapDef.pickups`), not randomized - the simplest option, consistent with how doors/switches/interactables (2) and objectives (3) are all authored, and randomized pickup pools are naturally a campaign-generation (#5) concern once there's a pool to draw from, not a single-mission one.
- Persistence between missions: explicitly out of scope for this feature - there's no campaign/save layer yet for "unused consumables carry over" to mean anything. Revisit at #5.
- Stimulants and special ammo types (armor-piercing etc.) from the design sketch's candidate list: deferred. Both need a status-effect/damage-type system this codebase doesn't have (0b's Resolved already flagged the same gap for revive); `ItemType` is a plain string union specifically so adding a case later is a small, additive change, not a rework.
- Enemy death drops (loot for the player) and an ally-to-ally ammo hand-over action: deferred - both are extensions of the same pickup/reserve machinery just shipped, not blocked by anything, but neither has a concrete need yet (no loot/equipment system (#7) to feed, no scenario in Training Grounds where hand-over would matter). Worth revisiting once #7 wants a reward loop.
- Fog treatment for pickups: current-visibility-only, no remembered state (documented above) - a deliberate simplification from doors' `Memory.doors` model. A door has meaningful state to misremember (open vs. closed); a pickup is binary present/gone and re-verifiable on any glance, and modeling "I remember a pickup used to be here" would mostly just be wrong once someone else grabs it off-screen. `GameState.pickups` itself is always the complete, unfogged list (like `interactables`/`objective`) - fog is enforced at the UI/render layer, not by hiding data from state.
- New events: shipped `pickup` (id, item type, amount, position); did not add a separate `ammoLow` event from the design sketch - the HUD already shows live reserve/ammo numbers on the unit card at all times, and `validate()`'s `'No reserve ammo'`/`'Out of ammo'` messages already surface the moment it matters, so a threshold-crossing event would be a second way to say the same thing without a clear reason to prefer it yet.

**Tests:** `core/pickups.test.ts` (new, 13 tests) - reload draws the right amount from reserve (full and partial), is refused with an empty reserve, and a full magazine still refuses reload even with reserve left (the pre-existing rule, unchanged); an ammo pickup grows `reserve` not `ammo` directly, a medkit pickup grows `medkits`, a gadget pickup grows gadget `uses`; collection happens mid-path as well as on the final tile; an enemy unit can collect a pickup too; a documentation test spelling out that `GameState.pickups` carries no fog memory; the AI never attempts a reload with an empty reserve, heads for a *visible* ammo pickup when genuinely dry, never heads for one it hasn't seen (fog-fair), and doesn't waste a turn attempting an attack it has no ammo for. `core/mapFormat.test.ts` gained 9 tests mirroring the interactables (2) validation suite - round-trip (including a default vs. explicit `amount`), builder round-trip, unknown type, off-tile position, duplicate id, sharing a tile with a unit/interactable/another pickup, and a bad `amount`. Verified live in a driven headless browser: the three builder pickup tools (placement, toggle-off-by-repainting, JSON export round-trip) and the in-game unit card showing `Ammo 6/6 (+18 reserve)` correctly, both with no console errors.

---

## Meta-game layer

The features above give a single tactical mission its vocabulary. These four turn that into an actual game loop: base -> equip/level the squad -> pick a mission from the campaign map -> play it -> return to base. They need at least a minimal second mission and a persistent save file to test end-to-end, so they come after 1-4.

## 5. Campaign map & mission generation

**Status: done.**

**Goal:** a map/menu screen between missions where the player picks the next mission. Some missions are auto-generated from a pool (supply runs and similar); one story mission per act is handcrafted and fixed for that playthrough.

**Where we are:** `data/campaign.ts` (new) defines `DISTRICTS` (all seven from the story section's table, `DISTRICT_ORDER` fixing their play order - see Resolved on branching), `STORY_MISSIONS` (Act 1's four handcrafted missions from the Act 1 table: `lights-out`, `signal-fire`, `supply-run-market-row`, `jackals-den`, each with its own blurb/objective text - Acts 2-3 have districts but no missions yet, matching the story section's own "none of act 2 or 3 needs detail yet"), and the generation inputs for supply runs (`SUPPLY_RUN_NAMES`, `SUPPLY_RUN_PROFILE_TIERS` - four difficulty tiers of `AiProfileId` pools, easiest to hardest). `core/campaign.ts` (new) is the pure generation/progression logic the design sketch called for: `CampaignState` (seed, an RNG cursor reusing `core/rng.ts`'s `nextRandom` exactly like `GameState.rng` does, `unlockedDistricts`, `completedStoryMissions`, a rotating `supplyRunPool` kept topped up to 3, `completedSupplyRuns`/`currency` counters). `newCampaign(seed)` starts with only the first district unlocked and a freshly generated pool; `completeStoryMission`/`completeSupplyRun` mutate a `CampaignState` in place (the same imperative style `GameState` itself uses, not a pure-functional update) - completing every story mission in a district unlocks the next one in `DISTRICT_ORDER`, completing a supply run banks its reward and regenerates that one pool slot (not the whole pool) at whatever difficulty tier `completedSupplyRuns` has reached (one tier harder every 3 completions).

Persistence: `ui/campaignStore.ts` (new) mirrors `mapStore.ts`'s/`keybindings.ts`'s established pattern exactly - `loadCampaign`/`saveCampaign`/`clearCampaign` around `localStorage`, falling back to `null`/`false` on anything from a private-browsing block to corrupt JSON, with a light structural check (every expected field present and the right type) before trusting a loaded save. `ui/campaign.ts` (new) is the screen itself: a `Campaign` class owning its own `CampaignState` (loaded on construction, or a fresh one if there's nothing saved yet), rendering district status chips, the current district's available story missions, and the live supply-run pool, each as a "Play" button. `src/main.ts` wires it in without touching `Session`'s API at all: picking a story mission hands its `MapDef` straight to the existing `startGame` helper (same one the home screen's mission list already uses); picking a generated mission does the same with a small per-play clone (`{ ...m.map, enemyProfile: m.enemyProfile }`) so its rolled difficulty actually applies, since `createGame` already reads `MapDef.enemyProfile` as a per-mission default. main.ts tracks which mission (if any) is currently being played from the campaign screen and, on "Main menu" or the win/loss banner's menu button, reports a win back to `Campaign.reportWin` (which itself figures out story vs. supply-run and saves) before returning - to the campaign screen specifically, not home, if that's where the mission was launched from, so finishing one mission flows straight into picking the next.

**Design sketch**
- `data/campaign.ts` (new): the story mission sequence, plus the supply-run generation pool — mission templates parameterized by map, enemy count/composition, objective type (#3), and a reward table.
- A `CampaignState` (new, alongside `GameState`) tracking which missions are available, completed or locked, persisting between sessions.
- Generation draws from the existing seeded RNG so a given campaign seed produces reproducible mission pools, same as everything else in `core`.
- A new UI screen (`src/ui/campaign.ts`) lists available missions with briefing text and feeds into the existing `session.ts` mission-start flow.

**Touches:** `data/campaign.ts` (new), `core/campaign.ts` (new), `ui/campaign.ts` (new), `ui/campaignStore.ts` (new), `main.ts` (wiring), `ui/home.ts` (`Screen` gained `'campaign'`), `index.html`/`ui/style.css` (the new screen's markup and styling).

**Resolved**
- `CampaignState` lives in `core/campaign.ts`, not `core/types.ts` as the design sketch's touch list originally suggested - it's a genuinely separate state tree from `GameState` (a campaign has zero missions in progress most of the time, and a `GameState` doesn't know it's part of a campaign at all), so growing `core/types.ts` - which is specifically `GameState`'s shape - with an unrelated tree would have blurred that boundary for no benefit. Purely an organizational call, not a behavioral one.
- Story mission sequence: linear, via a single fixed `DISTRICT_ORDER` - not branching. Simplest to reason about and matches the story section's own act structure (three acts, one path through Ashport); a branching structure can layer on top later (e.g. per-district unlock prerequisites instead of a flat array) without touching `STORY_MISSIONS`' own shape.
- Story missions are **not** derived from the campaign seed at all - they're static handcrafted data (`STORY_MISSIONS`), the same for every campaign regardless of seed. This is a clarification of the original Tests bullet below, which suggested they might "differ between fresh playthroughs (new seed)" - that reads as inconsistent with the Goal's own "handcrafted and fixed for that playthrough" framing; handcrafted content that varies by seed isn't really handcrafted. Only the generated supply-run pool is seed-derived.
- What persists between missions: for now, only campaign-level progress (unlocked districts, completed missions, the supply-run pool, currency) - nothing about a squad's HP/injuries/consumables carries between missions yet, since there's no persistent roster concept at all (every mission still spawns the same fixed `Spawn` list from its `MapDef`). That's squarely a #6/#7 concern (a roster that exists independent of any one mission's `GameState.units`) and is explicitly out of scope here.
- Mission pool size: fixed at 3 concurrent supply-run offers, each independently replaced (not the whole pool at once) the moment it's completed - keeps the list from ever going stale/empty and matches "regenerate what's gone" better than "regenerate everything periodically."
- Supply-run difficulty scaling: yes, resolving the open question - `SUPPLY_RUN_PROFILE_TIERS` has four tiers (easiest to hardest), advancing one tier every 3 completed supply runs, both the enemy-profile pool and the reward amount scale with tier.
- ~~**The four Act 1 story missions all use Training Grounds' own layout as a placeholder `MapDef`, not real per-district maps.**~~ **Closed** - all four (and five more for the supply-run pool) are now hand-authored in `src/data/maps/`; see [STORY.md](STORY.md). The prediction below held exactly: swapping in real maps was a pure data change to `STORY_MISSIONS` plus a template list, with no rework in `core/campaign.ts`. Original note: This is the single biggest scope cut in this feature: hand-authoring four balanced, thematically distinct tactical maps (Riverside/Market Row layouts, unique to a "lived-in district" rather than the rules-exercise range - see the Act 1 section's own open question) is level-design content work, not a system to build - the campaign *engineering* (generation, progression, persistence, the UI screen, launching missions with the right difficulty) is fully built and tested end-to-end against this placeholder content, and swapping in real maps later is a pure data change to `STORY_MISSIONS`, not a rework of anything in `core/campaign.ts` or `ui/campaign.ts`. Generated supply-run missions use the same placeholder for the same reason - there's no second real map anywhere in the game yet to draw from.
- Reward currency (`CampaignState.currency`) is tracked and banked correctly but **nothing spends it** - that's #6 (base building), the first feature that gives it a purpose. Modeled now so #6 doesn't need to touch the campaign save shape to add spending.
- **Partly closed.** Generated missions now vary by hand-authored layout (five of them, each with its own enemy count and composition) and by a rolled weather/time/ammo-scarcity complication, on top of the enemy-profile tier. There is still no *randomized* spawn generator - variety comes from authored templates, which is the deliberate trade. Original note: (the design sketch's "mission templates parameterized by map, enemy count/composition, objective type") - Training Grounds' fixed 5-enemy layout is the only map available (see above), so varying enemy count/composition would mean hand-editing spawns per generated mission, which needs either a second real map or a spawn-randomization system neither of which exists yet. Deferred alongside the placeholder-map limitation.

**Tests:** `core/campaign.test.ts` (new, 10 tests) - a fresh campaign starts with only the first district unlocked and a full pool; supply-run pool generation is deterministic for a given seed and differs for a different one; story missions are identical across different seeds (the static-data clarification above); only available (unlocked, not completed) story missions are listed; completing every mission in a district unlocks the next one, including the "nothing left to unlock crashes nothing" edge case for districts with no missions written yet; completing a mission twice is a no-op; completing a supply run banks its reward, retires it, and tops the pool back up without ever reusing an id within one campaign; difficulty genuinely escalates with completions (the freshly-regenerated pool slot, not stale untouched ones, is checked - since only the replaced slot reflects the current tier). Verified end-to-end in a driven headless browser: entering the campaign screen, playing and winning a story mission (removes it from the list, no currency change), returning specifically to the campaign screen rather than home, then playing and winning a supply run (currency increases by its exact reward, the pool regenerates to 3 fresh entries) - all with no console errors.

---

## Story and level design

**Status: done - moved out of this file.** The premise, the three factions, the act structure and a
per-mission design sheet for every level that exists now live in **[STORY.md](STORY.md)**, alongside the
supply-run pool's own design (five hand-authored layouts x six complications x four difficulty tiers).

What changed since this section was a set of planning bullets:

- **Act 1 has ten story missions, five per district, each on its own hand-authored 48x32 map**
  (`src/data/maps/story/`), one per objective type, none reusing Training Grounds. That closes #5's biggest
  scope cut (see its Resolved list). The maps are composed structurally via `src/data/maps/compose.ts`.
- **The story is told in the UI**, not just in this repo: each district has a briefing modal shown once when
  it unlocks, and each story mission has a debrief shown when it is completed.
- **Generated supply runs draw from five more hand-authored layouts**, not one placeholder, and roll a
  weather/time/scarcity complication on top. A saved campaign stores the template id, not a baked `MapDef`.
- `scripts/sim.ts` gained `--map <id>` so every layout can be balance-checked the same way Training Grounds
  always has been. Each map file's header comment records its own numbers.

The Act 1 open questions this section used to carry are answered in STORY.md: the recruit from mission 1 is
narrative-only for now, and the Jackal leader is a `tank` on the `camper` profile rather than a new stat
block or a boss affix.

---


## 6. Base building

**Status: done.**

**Goal:** a home-base screen with buildable/upgradeable facilities (medstation, workbench, etc.) that provide meta-progression bonuses or unlock actions between missions.

**Where we are:** `data/base.ts` (new) defines three facilities, each with three cost/effect tiers - `medstation` (extra medkits per unit), `workbench` (a percentage bonus to starting reserve ammo), `commsRelay` (extra gadget uses per unit). `core/base.ts` (new) is the pure state/logic layer the design sketch called for: `BaseState { levels: Record<FacilityId, number> }` (0 = unbuilt), `facilityLevel`/`facilityEffect`/`upgradeCost` (reads), `buildLevel` (the mutation itself - advances one tier, no cost-checking of its own), and `baseGameOptions(base)` which turns the currently-built levels into the bonus amounts a mission needs to apply them. `core/campaign.ts`'s `CampaignState` gained a `base: BaseState` field (initialized by `newBaseState()` in `newCampaign`) and a new `upgradeFacility(cs, id)` function that composes cost-checking with the mutation: reads `upgradeCost(cs.base, id)`, refuses with a reason string if it's null (maxed) or unaffordable, otherwise deducts `cs.currency` and calls `buildLevel` - this is the layer that actually answers open question #1 below, since currency lives on `CampaignState`, not `BaseState`.

Three small, additive `GameOptions`/`MapDef` fields carry a built base's bonuses into a mission exactly the way `reserveMult` (4) already does: `medkitBonus`, `gadgetUsesBonus` (flat additions, player-only), and `playerReserveMult` (a *player-only* multiplier, deliberately separate from the existing `reserveMult` - see Resolved). `core/state.ts`'s `createGame` reads all three, applied only to the player team's units (an enemy squad never benefits from the player's own base upgrades). `ui/base.ts` (new) is the screen itself: three facility cards (current tier reached, each tier's cost/effect, an Upgrade button disabled when unaffordable or already maxed), reading and mutating the same live `CampaignState` object the campaign screen (5) already owns - `main.ts` hands it over via `campaign.campaignState()` rather than the base screen loading its own separate copy, so a spend here is immediately reflected back on the campaign screen with no extra save/reload round-trip. `ui/campaign.ts` gained an `applyBase(map)` step, called right before handing a mission's map to `startGame`, that layers the currently-built bonuses onto that specific mission's own `MapDef` (so a scarce mission's own `reserveMult` and the workbench's bonus both still apply, additively). `ui/campaignStore.ts`'s load path repairs (rather than rejects) a campaign saved before this feature existed, by defaulting in a fresh, unbuilt `BaseState` if `.base` is missing.

**Design sketch**
- `data/base.ts` (new): facility types, upgrade tiers, costs and effects — e.g. the medstation heals/removes injuries between missions, the workbench enables crafting or upgrading equipment (#7).
- `BaseState` (new): built facilities and their levels, persisted in the campaign save.
- A base UI screen (`ui/base.ts`, new) for construction and upgrades, spending a resource/currency earned from missions.

**Touches:** `data/base.ts` (new), `core/base.ts` (new), `ui/base.ts` (new), `core/campaign.ts` (`CampaignState.base`, `upgradeFacility`), `ui/campaign.ts` (`applyBase`, a "Base" button), `ui/campaignStore.ts` (backward-compat repair), `core/types.ts`/`data/trainingGrounds.ts` (the three bonus fields), `core/state.ts` (`createGame` applies them), `main.ts`/`ui/home.ts` (the new screen), `ui/hud.ts` (see Resolved - a pre-existing display bug this feature exposed), `ui/style.css`.

**Resolved**
- Currency: reuses `CampaignState.currency` (5) rather than a separate resource type - it already exists specifically because feature 5's own Resolved section flagged base building as "the first thing that spends it." No new resource, no new economy to balance twice.
- The medstation does **not** heal or remove injuries between missions, as the design sketch originally floated - there is no persistent per-unit injury/roster concept in this codebase at all yet (every mission still spawns a fresh, fixed unit list from its own `MapDef.spawns` - see #5's own Resolved section on the same gap). Instead it grants extra starting medkits per mission, a bonus that's real and measurable *today* without inventing a roster system - consistent with this session's running pattern of shipping a working system against what currently exists rather than a stub for what doesn't. Revisit "heals between missions" once #7/#8 give a unit's state somewhere to persist to.
- Construction/upgrade is instant, not time-gated (no "N turns/missions to complete") - the simplest option, and nothing about the campaign's pacing (a few missions between visits to the base) currently creates pressure that a build timer would meaningfully push back against.
- Facility slots: fixed at three (medstation, workbench, comms relay), each independently upgradeable through three tiers - not an expandable number of build slots. Matches the design sketch's own "medstation, workbench, etc." framing (a short, fixed list) rather than a base-building game with placement/layout, which is well beyond this project's scope.
- `playerReserveMult` is a **new**, separate field from `reserveMult` (4), not a reuse of it - `reserveMult` is symmetric (it was designed to make a *mission* scarcer for both sides equally), so baking the workbench's bonus into it would have quietly boosted the enemy's ammo too. Keeping them distinct multipliers, combined multiplicatively in `createGame` (`reserveMult * playerReserveMult` for the player team only), was cheaper than reworking `reserveMult` into being team-aware after the fact.
- `medkitBonus`/`gadgetUsesBonus`/`playerReserveMult` are modeled as ordinary `MapDef` fields (like `reserveMult`/`enemyProfile` before them), even though no mapper would ever hand-author them - `ui/campaign.ts`'s `applyBase` sets them programmatically on a per-play clone of the mission's map before handing it to the existing `startGame`/`Session.load` path. This needed zero changes to `Session`'s own API, at the cost of a slightly unusual (system-set, not hand-authored) use of a couple of `MapDef` fields - the same trade-off #5 already made for a generated mission's `enemyProfile`.
- **Found and fixed in passing**: `ui/hud.ts`'s unit card showed medkits and gadget uses as `current/RULES.constant` - a genuine display bug once either can exceed the flat constant (medkit/gadget pickups (4) could already trigger this; this feature's bonuses make it commonplace). Neither value has a real fixed cap the way ammo has a magazine size, so both now just show the current count, matching how ammo reserve is already shown as a bare `+N` rather than implying a ceiling.

**Tests:** `core/base.test.ts` (new, 9 tests) - a fresh `BaseState` starts fully unbuilt with every facility at level 0; `buildLevel` advances exactly one tier and its cost/effect follow the tier table; `upgradeCost` is null once maxed; `baseGameOptions` reflects each facility independently and is all-zero when nothing is built; `upgradeFacility` spends the right amount and advances the level, refuses (charging nothing) when currency is short, and refuses once a facility is already maxed; `medkitBonus`/`gadgetUsesBonus` affect only the player team when applied to a real `GameState` via `createGame`, never the enemy (an enemy unit has no gadget at all regardless); `playerReserveMult` and the existing symmetric `reserveMult` (4) compose correctly and independently - the player's reserve reflects both, the enemy's only the symmetric one. Verified end-to-end in a driven headless browser: winning three supply runs to bank currency, spending it on the base screen (currency deducted correctly, tier/afford-ability states render correctly, an unaffordable upgrade shows disabled), returning to the campaign screen with the spend already reflected with no reload, and finally confirming a built medstation's bonus shows up correctly on the unit card in a real campaign mission - all with no console errors.

---

## 7. Unit equipment screen

**Status: done** (loot acquisition only - buy/craft deferred, see Resolved).

**Goal:** each unit has an armor slot and two equipment slots that change its effective stats, filled from gear that's bought at base, crafted from found materials, or looted during a mission.

**Where we are:** `Unit` (`core/types.ts`) gained `armor: ArmorId | null` and `equipment: [EquipmentId | null, EquipmentId | null]`. `data/armor.ts` (new) has two pieces (`lightVest` +1, `heavyPlate` +3), stacking on the class's own base armor via `core/combat.ts`'s new `effectiveArmor(u)`, which replaced every direct `CLASSES[u.cls].armor` read (`damageAgainst`'s three call sites, `expectedDamage`). `data/equipment.ts` (new) has three pieces, each expressed as a partial `EnvModifier`-shaped bonus exactly as the design sketch sketched: `boots` (flat move bonus), `flashlight` (counters weather's vision penalty specifically), `nvg` (counters time-of-day's vision *and* accuracy penalty specifically). `core/environment.ts` gained the equipment-aware layer the design sketch called for - `effectiveVision`/`effectiveMove`/`effectiveAccuracyMod` - sitting alongside (not replacing) the existing `scaledVision`/`scaledMove`/`envMods`, which stay as the pure environment-only utilities `core/vision.ts`, `core/ai.ts`, `core/actions.ts`'s `moveRange` and the HUD's unit card now call the new equipment-aware versions instead. Each penalty source (weather vs. time-of-day) is countered independently by blending its own multiplier halfway back toward 1 (`blendTowardOne`) - a flashlight does nothing for a clear-weather midnight, NVG does nothing for a sunny storm, and having both counters a stormy midnight more than either alone.

Loot: `data/loot.ts` defines one shared weighted table (armor and equipment pieces only - see Resolved on ammo/medkits staying separate) and a pure `rollLoot(roll)`. `core/loot.ts`'s `dropLoot(s, x, y)` rolls it via the seeded RNG and pushes an ordinary `Pickup` (reusing #4's exact delivery mechanism, per the design sketch) with a new `itemId` field identifying the specific piece. `core/actions.ts`'s `collectPickup` grew two more branches: an armor pickup replaces the armor slot outright, an equipment pickup fills the first empty slot or replaces slot 0 once both are full (no "drop the old one" bookkeeping - see Resolved). `InteractableType` (2) gained `'chest'`: opened via the same generalized `interact` action as a door/switch, but one-way (`interactableBlock` refuses re-opening one already marked `active`) and its own effect is `dropLoot` at its own tile instead of toggling state, emitting a new `chest` event. Enemy deaths drop loot too, via a new `lootOnDeath(s, target)` - **called from both of this codebase's two separate death paths** (`core/combat.ts`'s `finalizeDeath`, a finishing shot, and `core/state.ts`'s `tickBleedOut`, dying from an unrevived downed timer), a real gap caught while implementing this - originally only the first path dropped loot, silently missing every unit that bled out instead of being finished off.

Persistence: `CampaignState` (5) gained `loadouts: Partial<Record<ClassId, UnitLoadout>>` and `unlockedGear: { armor: ArmorId[]; equipment: EquipmentId[] }`. `core/campaign.ts`'s new `recordMissionGear(cs, units)` - called from `ui/campaign.ts`'s `reportWin` with the just-finished mission's final player units - persists each class's ending loadout (so "what the soldier is carrying" survives to its next mission) and permanently unlocks whatever armor/equipment ids it finds, deliberately decoupled from a live `GameState`/`Unit` (it takes a minimal structural shape instead) so it stays testable without spinning up a mission. `ui/campaign.ts`'s `applyBase` (6) now also bakes `startingLoadouts: this.state.loadouts` onto a launched mission's map, read by `core/state.ts`'s `createGame` (player units only - enemies never start with gear) via a new `MapDef.startingLoadouts` field, the same "system-set MapDef field" trick already used for base-building bonuses. A new `ui/equip.ts` screen (reached via an "Equip" button on the campaign screen, alongside "Base") lists all five classes with an armor dropdown and two equipment dropdowns, options limited to `unlockedGear` plus "None" - nothing is assignable until it's actually been found. The map builder (`ui/builder.ts`) gained a Chest tool (paints/erases exactly like Door/Switch); `render/renderer.ts` draws a chest (shut with a gold clasp, open with a tipped-back lid) and two new pickup diamond icons (a shield for armor, a small square for equipment), all fog-fair via the same current-visibility/remembered-state rules as every other interactable/pickup.

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

**Touches:** `core/types.ts` (armor/equipment slots on `Unit`, `Pickup.itemId`, `chest`/`pickup.itemId` events), `data/armor.ts` (new), `data/equipment.ts` (new), `data/loot.ts` (new), `core/loot.ts` (new), `core/combat.ts` (`effectiveArmor`, `lootOnDeath` from both death paths), `core/environment.ts` (`effectiveVision`/`effectiveMove`/`effectiveAccuracyMod`), `core/vision.ts`/`core/ai.ts`/`core/actions.ts` (call the new equipment-aware functions), `core/state.ts` (`startingLoadouts` applied at spawn), `core/mapFormat.ts` (chest type + pickup `itemId` validation), `core/campaign.ts` (`loadouts`/`unlockedGear`, `recordMissionGear`), `data/trainingGrounds.ts` (`InteractableType` gains `chest`, `PickupDef.itemId`, `UnitLoadout`, `MapDef.startingLoadouts`), `ui/equip.ts` (new), `ui/campaign.ts` (`applyBase` extended, `reportWin` extended), `ui/builder.ts` (Chest tool), `render/renderer.ts` (chest + armor/equipment pickup art), `ui/hud.ts` (armor/gear on the unit card, plus a pre-existing medkit/gadget-uses display bug this feature's bonuses exposed - see feature 6's own Resolved for the twin of this fix), `ui/log.ts` (chest + specific-item pickup lines).

**Resolved**
- Armor stacks on top of the class's innate armor, doesn't replace it - resolves the open question with the answer its own phrasing already implied ("a tank keeps its base 3 plus gear"). Simpler to reason about than a replacement rule, and keeps every class's identity (a tank is always tankier) intact regardless of loadout.
- Acquisition: **loot only** for v1, not all three routes from day one. Buying needs #6's base screen to sell something (it currently only has facilities to build) and crafting needs a materials concept that doesn't exist anywhere in this codebase - loot alone already needed #2 (chests) and #4 (pickups) fully wired together and was enough to prove out the whole armor/equipment stat-effect system end to end. Revisit "buy" once #6's base screen has a reason to sell gear.
- Equipment is a **shared, freely-reassignable pool** (`CampaignState.unlockedGear`), not bound to a unit once equipped - resolves the open question in the more flexible direction. This followed naturally from keying persistence by *class* rather than by an individual persistent unit instance (see below): "the soldier" is a role, not a specific person yet, so its gear is reassignable at the equip screen the same way its class abilities always were.
- Flashlight/NVG **blunt, not cancel**, the relevant penalty (50% - `weatherVisionCounter`/`timeCounter` in `data/equipment.ts`) - resolves the open question in the direction it already leaned toward ("probably easier to balance than a hard problem-solved item"). Each is applied to its own penalty source only, verified independently in tests (flashlight is a no-op on a clear-weather midnight, NVG a no-op on a sunny storm).
- **No persistent per-instance roster** - loadouts, and the campaign generally, still track a squad by *class* (one soldier, one sniper, etc. - Training Grounds' own fixed five), not by individually named, persisted unit instances. Equipment therefore persists per class ("what the soldier carries"), not per specific recruit. This is the same simplification #5/#6 already made (flagged in both of their own Resolved sections as "the next thing that will need solving"), and it held up again here without needing to be solved early - #8 (leveling, which needs individual XP/level state) is very likely the feature that finally forces the question, and equipment can migrate from per-class to per-instance at that point without changing its own mechanics.
- Loot table scope: **armor and equipment only**, not ammo/medkits/gadget-charges. Those already have their own placement system (#4's ordinary pickups, hand-authored on the map) and folding them into the *loot* table too would blur "found in a crate the mapper placed" with "randomly dropped," two different, already-working mechanisms that don't need unifying.
- No builder tool for placing an armor/equipment *pickup* directly (unlike the ammo/medkit/gadget pickup tools from #4) - by design, those two item types are meant to be discovered via the loot system (chests, enemy drops), not hand-placed with a specific piece pre-chosen; a Chest tool is what the builder needed, and got.
- No `scripts/sim.ts` balance knob for loadout variance - no mission uses `startingLoadouts` outside the campaign flow (Training Grounds standalone stays gear-free, matching 0f's "unchanged rules-sandbox" decision), so there's no fixed loadout scenario yet worth wiring a flag for; `npm run sim` continued to run clean (loot rolls happen on every simulated enemy death with no crashes or instability) as a smoke check, not a dedicated balance pass.

**Tests:** `core/equipment.test.ts` (new, 12 tests) - armor stacks correctly and changes `damageAgainst`'s output; boots add to `effectiveMove`; flashlight blunts weather's vision penalty and is a no-op with nothing to counter, NVG the same for time-of-day's vision *and* accuracy penalty, and both together counter more than either alone; an armor pickup replaces the slot, an equipment pickup fills the first empty slot then replaces slot 0 once full; opening a chest costs an action, drops a pickup at its own tile, and can't be reopened; an enemy death drops a pickup (both the finishing-shot and the bleed-out-timeout death paths are covered, since only one of them dropped loot before the gap described above was found and fixed); a downed-but-not-dead unit and a dead *player* unit never drop loot. `core/mapFormat.test.ts` gained 5 tests (chest round-trip, armor/equipment pickups requiring a valid `itemId`, ammo/medkit/gadget pickups still not requiring one). `core/campaign.test.ts` gained 4 tests for `recordMissionGear` (persists by class, only for the player team, overwrites rather than merges a class's own loadout on a later mission while still keeping earlier finds unlocked, never unlocks the same id twice). Verified end-to-end in a driven headless browser: placing a chest in the builder and confirming it renders and exports correctly; the unit card showing no "Gear" line and base armor/move/uses (no stray `/denominator`) before anything is equipped; forcing several supply-run wins with a unit carrying loot to confirm `unlockedGear`/`loadouts` persist to `localStorage` correctly; the equip screen showing the right dropdowns pre-selected; and, the real end-to-end proof, starting a **fresh** campaign mission afterward and seeing the soldier already wearing the found gear on its unit card (`Armor 2 (base 1)`, `Move 6 (base 5)`, a `Gear: Light Vest, Boots, Flashlight` line) with no manual equip step in that session - all with zero console errors throughout.

---

## 8. Unit leveling & perks

**Status: done** (post-mission XP, not live per-event accrual; per-class progress, not per-instance - see Resolved).

**Goal:** each class follows its own leveling path. Units earn XP from missions and from what they do during them, leveling up along that path; each significant level adds 2 new perks to that unit's perk pool, and at intervals unlocks another active-perk slot (starting at 1, capping at 3 chosen at once).

**Where we are:** `Unit` (`core/types.ts`) gained `xp`, `level`, `perkPool: PerkId[]` and `equippedPerks: PerkId[]`, exactly as sketched. `data/perks.ts` (new) defines 20 perks (4 per class), each a flat stat modifier in the `EnvModifier`-style pattern the sketch called for - accuracy, damage, armor, move, vision, or (for the medic) a medkit bonus. `data/leveling.ts` (new) defines `LEVEL_PATHS: Record<ClassId, LevelDef[]>`, a shared 5-level curve (thresholds 0/100/250/450/700) parameterized per class by its own 4 perks - levels 2 and 4 are the "significant" milestones (2 perks granted each), levels 1/3/5 each unlock one more equip slot (capping at exactly 3, per the goal). `core/leveling.ts` (new) is the pure logic: `xpEarned` (a mission's own final `dmgDealt`/`kills`/`revives`/`alive` counters, weighted and summed - see Resolved on why this replaced the event-stream idea), `gainXp` (adds XP, resolves a level-up, grants new perks to the pool without auto-equipping them), `resetOnDeath` (permadeath - see Resolved), `equipPerk`/`unequipPerk` (respect the pool/slot-cap split the design sketch asked for), and `perkBonus` (sums a set of equipped perk ids into one combined stat delta).

Perk effects landed exactly where the sketch predicted - "wherever the relevant stat already lives": `core/combat.ts`'s `effectiveArmor` and new `effectiveDamage` (armor/damage perks, both already there from #7's own pattern), and `core/environment.ts`'s `effectiveVision`/`effectiveMove`/`effectiveAccuracyMod` (vision/move/accuracy perks) - the exact same "effective *" functions #7 introduced for equipment now fold in a unit's equipped perks too, so combat/vision/movement code didn't need a second modifier-application site. `core/state.ts`'s `createGame` applies a class's `equippedPerks` (from `MapDef.startingProgress`, the same system-set-field trick as #6/#7) before computing starting medkits, so a medic's `medicTriage` perk's bonus medkit is present from turn one.

Persistence: `CampaignState` (5) gained `levels: Partial<Record<ClassId, ClassProgress>>`. `core/campaign.ts`'s `applyMissionXp` (called alongside #7's `recordMissionGear` from `ui/campaign.ts`'s `reportWin`) awards each surviving player unit's class its earned XP, or resets that class to level 1 if the unit died for good; a new `togglePerk` wraps `equipPerk`/`unequipPerk` with `CampaignState` access, used by the equip screen. `ui/equip.ts` (7) was extended rather than adding a sixth top-level screen (see Resolved): each class card now also shows its level/XP/next-threshold and a perk checklist (checked = equipped, disabled once the slot cap is reached), reusing the exact same live-`CampaignState`, no-copy pattern the gear dropdowns already used. `scripts/sim.ts` gained a `--player-level N` knob (the design sketch's own ask) that starts every player class at level N with its perks-so-far auto-equipped up to that level's slot count; at max level (5) a 100-match run shows a measurable balance shift (100% win rate, ~40% less average damage taken per class, matches resolving in ~5 turns instead of ~8) confirming perks have real, felt effect.

**Design sketch**
- `Unit` gains `xp`, `level`, `perkPool: PerkId[]` (perks unlocked so far) and `equippedPerks: PerkId[]` (currently active, limited by unlocked slot count).
- `data/leveling.ts` (new): a **per-class leveling path**, `Record<ClassId, LevelDef[]>`. Each `LevelDef` carries an XP threshold; **significant** levels (a subset flagged in the data, not every level) also list the **2 perks** added to that class's perk pool at that milestone, and some milestones instead (or additionally) unlock the next active-perk slot.
- `data/perks.ts` (new): the perk definitions referenced by the leveling paths, one list per class, each perk a data-driven stat/rule modifier in the same style as `EnvModifier` (bonus accuracy, extra move, cheaper gadget cooldown, and so on).
- **Slots vs. pool:** unlocking a perk (pool) and choosing to run it (equipped, up to the current slot count) are separate — a unit can bank more perks than it can currently use, and the player picks which unlocked perks fill the available slots.
- **XP sources:** a post-mission summary (objective completed, survived) plus per-action XP attributed from the existing event stream as it happens — a hit or kill credits the attacker (`shot`/`died`), objective progress credits whoever advanced it (`objective`/`capture`), a heal credits the medic (`heal`). A new `core/leveling.ts` turns those events into XP deltas per unit rather than inventing a parallel tracking mechanism.
- Perk effects apply wherever the relevant stat already lives (`core/combat.ts` for accuracy/damage perks, `core/vision.ts` for vision perks, `core/actions.ts` for cost/cooldown perks) — the same pattern `EnvModifier` already uses, just keyed by unit instead of by mission.

**Touches:** `core/types.ts` (`xp`/`level`/`perkPool`/`equippedPerks` on `Unit`), `data/leveling.ts` (new), `data/perks.ts` (new), `core/leveling.ts` (new), `core/combat.ts` (`effectiveArmor` extended, new `effectiveDamage`), `core/environment.ts` (`effectiveVision`/`effectiveMove`/`effectiveAccuracyMod` extended), `core/state.ts` (`startingProgress` applied at spawn, including the medkit perk), `core/campaign.ts` (`levels`, `applyMissionXp`, `togglePerk`), `data/trainingGrounds.ts` (`ClassProgress`, `MapDef.startingProgress`), `ui/campaign.ts` (`applyBase`/`reportWin` extended), `ui/campaignStore.ts` (backward-compat repair), `ui/equip.ts` (extended, not a new screen), `ui/hud.ts` (level badge + perks line on the unit card), `scripts/sim.ts` (`--player-level`).

**Resolved**
- **XP is a post-mission summary only, not a live per-event stream during the mission** - a real scope cut from the design sketch's "per-action XP attributed from the existing event stream as it happens." Streaming XP live would need attribution the event stream didn't have yet (the `died` event carries no killer field) and raises questions the sketch didn't need to answer for a working v1 (does a mid-mission level-up apply its bonus retroactively to the same mission? almost certainly not, which makes "live" mostly cosmetic anyway). `xpEarned` computes the same total from a unit's own final `dmgDealt`/`kills`/`revives`/`alive` counters instead - the identical information, summarized once, with no event-attribution machinery to get right. A live feed (XP notifications mid-mission) can be layered on top later without changing this function's role as the source of truth.
- XP amounts (1 per damage, 15 per kill, 10 per revive, a flat 5 for surviving) and per-class thresholds (0/100/250/450/700, shared across every class in v1) are placeholder numbers, explicitly flagged as balance work in `data/leveling.ts` itself - `--player-level` on `scripts/sim.ts` is the tuning knob the open question asked for, and a 100-match run at max level already shows they have real, measurable effect (see Where we are), which is what v1 needed to prove before tuning exact numbers.
- Equipping/unequipping is **free and instant, any time at the equip screen** - respec anytime, no lock-in. Pool unlocks are the permanent progress; the active loadout is just "which of what you've already learned are you using right now," the same resolution #7 gave the identical question for equipment.
- Perks and equipment (7) **do stack**, deliberately uncapped in v1 - e.g. a move perk plus boots simply add. No mission or sim run so far has produced a combination that looks broken enough to need a cap; the placeholder-number tuning pass above is the natural place to revisit this once real per-district content (not just Training Grounds) exists to stress-test it.
- Permadeath: **yes, real stakes** - a class that loses its unit for good resets to level 1, XP 0, with nothing equipped (`resetOnDeath`). The one refinement beyond the open question's own framing: the **unlocked perk pool is not lost** - it persists permanently, mirroring #7's `unlockedGear` never being taken away either. The reasoning carries over unchanged: "institutional knowledge" (a technique the squad has learned) surviving the death of the specific person who last held that role reads better than forcing a full blank slate, while XP/level/loadout resetting still delivers genuine stakes ("you're back to square one with this class, but not from zero knowledge").
- **No live per-instance roster was introduced** - levels persist per **class**, the same simplification #5/#6/#7 already made and flagged as "the next feature will probably force this." It didn't, again: Training Grounds' fixed one-unit-per-class squad means class-keyed progress and instance-keyed progress are observationally identical for every mission that exists today. This is now the fourth feature in a row to get away with the simplification, which is itself useful data - a real per-instance roster (named recruits, individually tracked) is worth deferring until a feature *actually* needs to tell two units of the same class apart, which still hasn't happened. Revisit if/when Act 1's real per-district maps (still pending, see below) ever field two of the same class at once.
- **`ui/equip.ts` was extended rather than adding a new top-level screen** for the design sketch's "level-up/perk-pick screen" - it's the same "customize your squad between missions" concern #7's equip screen already covered, and every class card already had room for one more section. Avoids screen-proliferation for what the player experiences as one coherent "manage my squad" flow (Campaign -> Base / Equip, not Campaign -> Base / Equip / Perks).

**Tests:** `core/leveling.test.ts` (new, 19 tests) - `xpEarned`'s weighted sum; `levelForXp`/`slotCount` hit every class's own thresholds and the slot cap never exceeds 3; `gainXp` adds XP and no-ops below a threshold, grants exactly 2 perks at a significant level without auto-equipping them, correctly grants every intervening milestone's perks when a single mission's XP jumps two levels at once, and never double-grants a perk already in the pool; `resetOnDeath` clears XP/level/equipped but keeps the pool; `equipPerk`/`unequipPerk` refuse a locked perk, refuse past the slot cap, treat re-equipping as a harmless no-op, and always let unequip free a slot; `perkBonus` sums correctly and is all-zero for none equipped; and, wired into real `Unit`s via `makeGame`, every perk category (armor, damage, move, vision, accuracy) is confirmed to actually change `effectiveArmor`/`effectiveDamage`/`effectiveMove`/`effectiveVision`/`effectiveAccuracyMod`/`hitChance` - not just the pure data functions in isolation. `core/campaign.test.ts` gained 6 tests for `applyMissionXp`/`togglePerk` (awards XP only to surviving player units, levels up and grants perks, accumulates across missions, permadeath resets correctly while preserving the pool, slot-cap and locked-perk refusals). Verified end-to-end in a driven headless browser: winning missions with a boosted soldier until it reaches level 2, confirming the equip screen shows the right level/XP/next-threshold and an unlocked-but-unequipped perk checklist, equipping one via its checkbox and confirming it persists to `localStorage`, and then - the real proof - starting a **fresh** mission afterward and seeing the soldier's unit card show `Lv 2`, the perk's stat bonus already applied (`Armor 2 (base 1)`), and a `Perks: Grit` line, with no manual equip step in that session and zero console errors throughout.

---

## 9. Visual rehaul

**Goal:** replace the placeholder presentation - procedural canvas shapes for everything - with a real, cohesive visual style across the whole game: units, items/equipment, map tiles, doors and pickups, and the meta-game screens (base building, equipment, campaign map) that 5-8 introduce.

**Where we are:** `render/renderer.ts` draws everything with `ctx.fillRect`/simple canvas primitives - no image assets, no sprite sheets, no animation beyond floating damage numbers and a pulsing tutorial highlight (0f). This was a deliberate placeholder from the start (nothing in `ASSUMPTIONS.md` claims otherwise) that let every mechanical feature ship without being blocked on art. By the time this feature is reached, a lot will exist that has never had real art at all: doors/switches (2), pickups/ammo crates (4), a campaign map (5), base-building facility screens (6), equipment/armor pieces and loot (7), and level-up/perk UI (8) - today all would-be flat-colored rectangles, not sprites being "upgraded" so much as drawn properly for the first time.

**Design sketch**
- Settle a visual style and palette *first*, as a small reference/style guide (mood, palette, tile-size convention, silhouette rules) - matching the "Offgrid"/Ashport story's gritty survival-tactics tone - so every asset made afterward (unit sprites, base building, campaign map icons) is checked against one standard instead of each feature inventing its own look.
- An asset pipeline: sprite sheets/images for units (per class, and per equipped-gear variant once 7 exists), terrain tiles, cover, interactables, pickups, and UI icons (gadgets, perks, action buttons), loaded once at startup and drawn via `ctx.drawImage` in place of procedural shapes.
- Keep the current procedural renderer available rather than deleting it - it has zero asset-loading dependency, is fast to iterate on, and the debug map builder benefits from a mode that never depends on art existing yet.
- Motion sells presentation more than static sprites do: at minimum, smooth unit movement between tiles (currently instant), a basic attack/hit flinch, and door open/close.
- Decide whether the rehaul extends to the HTML/CSS HUD chrome (action bar, panels, screens) or stays canvas-only, with the UI kept in its current minimal monospace-panel style - 0a's own design sketch already deferred a "full visual redesign" of HUD layout for the same reason (scope creep away from mechanics), so the same tension applies here in reverse: this is the feature where that deferred work would actually happen, if it happens at all.
- Base building (6), equipment (7) and the campaign map (5) need entirely new screens with no prior art to rehaul - for those, this feature is a first pass, not a second one, so sequencing this after 5-8 (rather than after each one individually) avoids drawing anything twice.

**Touches:** `render/renderer.ts` (asset loading + `drawImage` calls replacing procedural shapes, unit/tile animation), a new asset pipeline/build step (image files or sprite atlases, a loading screen/state while they load), `ui/builder.ts` (the map builder previews through the same renderer), `ui/style.css` (only if HUD chrome is in scope), and first-pass art for whatever `ui/` screens 5-8 introduced.

**Open questions**
- Static illustrated sprites (hand-drawn or generated 2D art) versus a more stylized geometric/vector upgrade (nicer shapes, gradients, lighting) that keeps today's "no external asset" simplicity - very different cost, effort and tooling tradeoffs.
- Does this wait for all of 2-8 to land (so nothing needs drawing twice), or proceed incrementally as each feature ships its own first-pass art? The design sketch above assumes the former for the meta-game screens specifically, but units/tiles/doors could reasonably get real art sooner.
- Sourcing/licensing for any external art assets, if that route is chosen, versus commissioning or generating original art consistent with the game's own IP.
- Performance: sprite-sheet loading and many `drawImage` calls at this map/unit scale should be trivial, but worth a sanity check once real art exists (many units, doors, pickups on screen at once, plus the campaign map's own scale).

**Tests:** this is a presentation change; the renderer's non-visual outputs (`View` computation, hover/highlight targeting, hit-chance math, and everything else `core`/`ui` already cover) shouldn't need new test coverage just because the pixels look different. Visual QA is manual/screenshot-based, the same driven-headless-browser workflow already used throughout 0a-0f, rather than automated pixel-diffing, at least for a first pass.

---

## 10. Polish pass: game feel, UX and presentation to web-game standard

**Goal:** the rules are ahead of most web tactics games, and the presentation is behind them. This feature closes
that gap in the order that buys the most per hour: things the player notices every turn first (feedback, camera,
losing progress), then options and summaries, then art (#9), then deeper AI/pacing work.

Each sub-item is its own commit and keeps the ground rules above (core stays pure; presentation reads state only).

| # | Item | Size | Status |
|---|---|---|---|
| 10a | Quick wins: HiDPI canvas, combat log for everyone, in-game modals instead of `confirm()`, generated key help, turn/enemy counter | small | done |
| 10b | Camera: drag to pan, arrow keys pan, Ctrl+wheel / keys zoom at the cursor, re-centre key | small | done |
| 10c | Mid-mission autosave and "Resume mission" | small-medium | done |
| 10d | Event playback: tweened movement, shot tracers, grenade blasts, screen shake, phase banner | medium | done |
| 10e | Procedural sound effects (WebAudio, no asset files) | small-medium | done |
| 10f | Settings: volume, animation speed, screen shake, colour-blind palette | small | done |
| 10g | Mission results screen (kills, accuracy, XP, loot) | small-medium | done |
| 10h | Safety: confirm ending a turn with unspent actions; undo a move that revealed nothing | small | done |
| 10i | Board visuals ahead of #9: soft fog edge, weather/night overlays on the canvas | medium | done |
| 10j | Gameplay depth: AI opens doors, retreat to real cover, enemy pods/activation, reinforcement timers | large | |
| 10k | Touch / small screens: pinch zoom, tap-to-preview-then-confirm | medium | |

**Design sketch**
- **10a.** *Done.* Also fixed on the way: the HUD only noticed a log reset when the new log was shorter than
  what it had rendered, so loading a mission could leave the previous one's lines up (`Session.logEpoch` now).
  Scale the board's backing store by `devicePixelRatio` (draw in tile units through `ctx.setTransform`) so
  it is sharp on HiDPI. The combat log already respects fog (`ui/log.ts`), so there is no reason to hide it outside
  debug: show it collapsed to the last few lines. Replace the three `confirm()` calls with `ui/modal.ts`. The key help
  under the board goes stale after a rebind, so build it from `keyFor`. Turn number and "enemies spotted / remaining"
  in the phase strip.
- **10b.** `ui/viewport.ts` owns scrolling already. Add pointer-drag panning (a drag past a few pixels
  suppresses the click), arrow-key panning (arrows are not bindable, so no conflict), and zoom around the cursor.
  A bindable "centre on selected" key.
  *Done as:* any mouse button drags (right-drag swallows its contextmenu so it doesn't also cancel); arrows are
  reserved and refused by the rebind screen; zoom is Ctrl+wheel / trackpad pinch and bindable `=`/`-` keys, not
  the plain wheel - hijacking the plain wheel breaks two-finger trackpad panning of the scroll box. `C` centres.
  The camera now only follows `Session.focusTile()` when it *changes* - `onChange` fires on every hover, and
  re-asserting an unchanged focus snapped the view back after every pan.
- **10c.** `GameState` is plain data apart from `Set`s and `Uint8Array`s, and the RNG is in the state, so a
  save is `serialize(state)` at the start of every player phase, keyed with the mission id (and campaign mission id
  if any). The home screen offers "Resume mission" when one exists; winning, losing or leaving clears it.
  *Done as:* `core/save.ts` (pure, round-trip tested incl. a resumed 48x32 game playing out identically),
  `ui/missionStore.ts`, `Session.onCheckpoint` (after each manual action, at the start of each player phase, at
  the end) and `Session.resume`. Leaving is *not* a clear - "Menu" mid-mission is exactly when you want to resume.
  Leaving while an AI phase is still animating plays it out at once (`Session.leave`): before this, the phase kept
  running on its timers behind the home screen and saved after the Resume button had already been labelled.
  Builder play-tests are never saved.
- **10d.** The core already emits `GameEvent`s. The UI turns them into a queue of short tracks (move along
  a path, tracer + muzzle flash, blast, flinch, death) and the renderer draws units at their animated position
  instead of their state position until the track ends. Input stays blocked while the queue plays; a speed setting
  (and "instant") scales every duration. `prefers-reduced-motion` defaults to instant and disables shake.
  *Done as:* `ui/anim.ts` (`buildTracks` is pure and tested; `Animator` samples it into an `AnimFrame`). Core's
  `move` event now carries the `path` actually walked, so an overwatch shot pauses the walk at the step it hit.
  The screen never runs ahead of what's been shown: HP bars hold pending damage, a dying unit stays up until its
  shot lands then fades, log lines carry an `at` time and appear when their event plays, and the tile tooltip hides
  during playback. Fog: an enemy's walk is clipped to tiles the player can see, and a shot from the fog draws
  only its impact. AI steps wait for the previous step's playback (`Session.aiDelay`). Phase banner is a DOM
  overlay (`#phase-banner`, `Hud.announcePhase`). Speed/shake live in `ui/prefs.ts`; 10f adds their controls.
- **10e.** A tiny WebAudio synth (noise bursts and envelopes) for select, step, shot, hit, miss, blast, door, UI
  click, phase change, win/lose. No files to license or load. Audio starts on the first user gesture.
  *Done as:* `ui/audio.ts` (23 recipes). Board sounds are `cues` from the same `buildTracks` timeline as the
  animation and are scheduled on the audio clock, so a hit sounds when the tracer lands. At instant speed the
  footstep cues are dropped (they'd all fire in the same instant).
- **10f.** Settings gains a "Game" section next to keybindings, stored like the bindings. The colour-blind
  palette swaps team colours to blue/orange in both CSS tokens and the renderer's palette.
  *Done as:* `ui/prefs.ts` + a "Game" group on the Settings screen. Colour-blind mode is
  `:root[data-palette="cb"]` for the DOM and `setColorblind` for the canvas (team fills, rings, overwatch zones,
  ghosts). Not covered yet: the HP-bar green/amber/red ramp, which reads by length as well as colour.
- **10g.** Replace the banner's two buttons with a debrief panel: per-unit kills, shots and hit rate, damage dealt and
  taken, XP gained and level-ups, and loot picked up. All of it is already on `Unit` or in the event stream.
  *Done as:* a table inside `#banner` (`Hud.results`). `Unit` gained `shotsFired`/`shotsHit` (counted in
  `fireWeapon`), which bumped `SAVE_VERSION` to 2 so older mid-mission saves are ignored rather than half-read.
  XP uses the campaign's own `xpEarned`, shown only on a win since that's the only time it's awarded. Loot is
  `Session.loot` (armor/equipment pickups) and is not in the save, so after a resume it lists only what was found
  since.
- **10h.** End turn with units that still have actions asks first (a "don't ask again" toggle). Undo: only the last
  move, only when it consumed no RNG and changed no team's `seenUnits`/`memory`. That is a snapshot and compare, and
  it cannot leak information.
  *Done as:* `Session.requestEndTurn` asks via `confirmEndTurn` (main.ts wires it to `confirmModal`; a Settings
  toggle turns it off). Undo is bindable (`Z`) with a topbar button: `try` snapshots the state before a move and
  keeps it only if the RNG didn't advance, `seenUnits.player` and `memory.player` are unchanged and nobody won.
  Newly visible empty floor is allowed (the layout is never secret). Any other action, or an auto-run phase,
  clears it. `confirmModal` now focuses the confirm button (E then Enter ends the turn) except for `danger`
  confirms, which focus Cancel.
- **10i.** Fog as a darkness overlay with a soft edge instead of greyscale tiles; rain streaks, fog haze and a
  night vignette from `envMods`. This is the start of #9, not a replacement for it.
  *Done as:* `drawFog` stretches a 2-px-per-tile mask with smoothing (a desaturate pass, then a darken pass), so
  the edge of sight fades over about half a tile; terrain and remembered doors are drawn in full colour under it.
  `drawDaylight` tints the board per time of day (and darkens for cloud/rain/storm); `drawWeather` draws rain
  streaks, drifting fog banks or cloud shadows, and storm lightning over the units, all as pure functions of the
  clock (no particle state). A "Weather effects" setting (`Prefs.weatherFx`, off under reduced motion) stills it;
  main.ts redraws at ~30 fps only while weather is moving and nothing else is.
- **10j.** Recorded as separate follow-ups once 10a-10i land: the AI's door handling (see `SESSION_HANDOFF.md`), the
  `hard` retreat finding in 0c, and pod activation + reinforcements as mission options (each with a sim knob).
- **10k.** After 10b: pinch zoom, and on coarse pointers a first tap previews (path, hit chance) and a second
  confirms.

**Tests:** 10c's serialize/deserialize round-trip (a resumed game plays the same as the original for the same
actions), 10h's undo eligibility rules and 10d's event-to-track conversion are pure and get unit tests. The rest
is presentation, checked in a driven headless browser as before.

---

## 11. Base overhaul: ten stations, a squad that carries its wounds, crafting

**Status: done.**

The base went from three flat bonuses to ten stations (`data/base.ts`, grouped Medical / Supply / Operations),
and the squad became something to manage between missions.

- **Wounds carry over** (`core/roster.ts`). `CampaignState.health` holds each class's HP after a won mission
  (missing = full). Then one mission's worth of time passes. Soldiers who deployed and survived get patched up
  for half the rest rate. Soldiers who sat it out rest at `REST_BASE` (20%), or 30-50% with the Barracks.
  Soldiers in an Infirmary bed heal 60%, 80% or 100% and are discharged once full. A downed survivor comes home
  on 1 HP. A fallen soldier's replacement starts at full HP (their class level resets as before).
- **Pick the squad per mission.** Picking a campaign mission now opens a briefing screen (`ui/briefing.ts`).
  Tick who deploys (at least one); anyone in a bed starts unticked. `deploySquad` drops the unpicked player
  spawns and sets `MapDef.startingHp`, which `createGame` applies.
- **Recon Uplink** feeds the briefing. Level 0 gives the hostile count only. Level 1 draws a map preview with
  the conditions. Level 2 adds hostile positions, types and profile. Level 3 adds caches, chests, doors and the
  objective tiles.
- **Fabricator + parts.** A second currency, `parts`: 4 per story mission and 2 + tier per supply run. Recipes
  are in `data/crafting.ts`, gated by fabricator tier. Scrapping returns half a recipe's cost, so crafting can
  never loop for profit. There are three new pieces: Med Pouch (+1 medkit), Bandolier (+50% reserve) and
  Ceramic Plate (+2 armor).
- **Locker capacity.** 6 pieces by default; 10, 16 or 24 with upgrades. Crafting refuses when the locker is
  full. After a mission, any overflow is scrapped, most duplicated pieces first (`trimLocker`).
- **Training Room** gives benched soldiers 15, 30 or 50 XP per mission. **War Room** puts 4, 5 or 6 supply
  runs on offer, and upgrading it adds the extra offers at once.
- An "After action" modal on the campaign screen lists the parts earned, the healing, the drills and anything
  scrapped.

**Resolved**
- *A loss changes nothing,* health included. The campaign already retried a loss from scratch (no XP or gear
  changes), and health follows the same rule. Revisit if losses ever start to cost something.
- *Time only passes on a won mission.* There is no "rest a day" button, because healing would then be free.
- *Still one soldier per class.* Choosing a squad means leaving classes home, not picking between two snipers.
  A per-instance roster (recruits, names, duplicates) remains the next step here; every map spawns exactly the
  five classes, which `deploySquad` relies on.

**Tests:** `core/roster.test.ts` covers health carry-over, rest, patch-up and infirmary rates, beds, discharge,
deployment, training XP, crafting gates, scrap values, locker trimming, parts income, the War Room, migration,
and the new gear's starting supplies.

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
