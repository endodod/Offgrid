# Ashport

The story bible. Premise, factions, the shape of all three acts, and a per-mission design sheet for every
level in the build. ROADMAP.md tracks *features*; this file tracks *fiction and levels*.

Rule of thumb used throughout: **nothing here needs a narrative system.** Every beat is carried by a mission's
objective type, its map, its weather, a district briefing modal, or a line of debrief text. If a beat can only
be told in a cutscene, it gets cut or rewritten until a map can tell it.

---

## 1. Premise

Three years ago the regional grid cascaded and never came back. The official line was a transformer
chain-failure. Nobody who lived through it believes that anymore.

Ashport is a mid-sized river city that ran on one utility contractor and one substation network. Without
power there is no water treatment, no refrigeration, no comms, and — quickly — no reason for anyone to keep
pretending the city is one place. It split along the lines that were already there: every district became
whoever had the guns and the fuel.

The squad starts as a handful of survivors working out of a dead substation in **Riverside**, doing supply
runs to stay fed. What turns that into a campaign is a working theory: *someone in this city can still throw
switches*. The people doing it call themselves the **Lamplighters**. Relighting a district is both the
fictional goal and the mechanical one — clear it, hold it, keep it.

**The line the whole game hangs on:** the lights going back on is not a reward for winning. It is the thing
that makes you visible.

---

## 2. Factions

| | Who | What they want | How they play |
|---|---|---|---|
| **The Lamplighters** | The player squad. Five people who were not anybody before the Blackout. | A block that stays lit. Then another one. | You. |
| **The Jackals** (Act 1) | Scavenger raiders — until Act 1 reveals they are being organised by somebody. | Whatever is not nailed down, and the people who are. | `easy` / `standard`. Aggressive, sloppy, punished by patience. |
| **The Cinder Wardens** (Act 2) | An organised militia that carved the city into fiefs. Checkpoints, tithes, ledgers. | Fuel and food, taken on a schedule, from people who cannot refuse. | `camper` / `hard` / `ambush`. Fortified positions and prepared ground. |
| **Halcyon Systems** (Act 3) | The utility and security contractor that ran Ashport's grid before the Blackout. | To keep the outage from ever being attributed. | Machines: sentries (bolted-down guns) and drones, plus the last Wardens on a Halcyon payroll. |

**The twist**, seeded from Riverside's fourth mission and paid off in Act 3: the Cinder Wardens are Halcyon's
contracted enforcement arm, still executing the last orders they were given long after anyone was left to
countermand them. The Blackout was Halcyon's — a failure they chose not to fix, because fixing it meant
admitting it had started on their side of the meter.

**The cinder-and-wrench stamp** is how that is seeded, and it is seeded four times before anybody explains it:

1. **The Pumphouse** — a maintenance sticker on the sluice board: *HALCYON SYSTEMS — DO NOT OPERATE WITHOUT AUTHORISATION*.
2. **The Row Relay** — a frequency list taped inside a transmitter cabinet, with one frequency that is not a Jackal frequency, signed with a cinder over a wrench.
3. **The Night Market** — Sable's ledger is not what the Jackals *took*. It is what they *handed over*, quarterly, marked PAID under the same stamp.
4. **The Jackals' Den** — Vex's fuel-tithe schedule, countersigned by the Cinder Wardens of the Dockyards, above the mark of the company that used to run the lights.

The player is told nothing. They are shown the same stamp four times in four different kinds of document.

---

## 3. Act structure

| Act | Districts | Antagonist | Shape |
|---|---|---|---|
| 1 | Riverside, Market Row | the Jackals | Teaches the loop: light a block, feed it, water it, take the road. Then find out the raiders have a landlord. |
| 2 | Dockyards, Substation Hill, Old Town | the Cinder Wardens | Escalation. Fortified positions, patrol/turret AI profiles, and an ammo economy that actually bites. |
| 3 | Uptown, The Spire | Halcyon Systems | Payoff. The Wardens collapse once Halcyon is exposed; the last mission is retaking the Spire and handing grid control back to the districts. |

District order is linear: Riverside → Market Row → Dockyards → Substation Hill → Old Town → Uptown → The
Spire. Each district has **five story missions**, played in order; clearing all five unlocks the next district
and shows its briefing. All seven are written: Act 1 in §4-§5, Act 2 in §8, Act 3 in §9. Winning the last
one shows the epilogue (`data/campaign.ts` `EPILOGUE`).

**District briefings** are a modal shown once, the first time a district unlocks (`District.intro` in
`data/campaign.ts`, tracked by `CampaignState.seenIntros`). **Mission debriefs** are the same modal, shown
when a story mission is completed (`StoryMissionDef.outcome`). Both queue from `Campaign.open()`, so finishing
the mission that clears a district shows the debrief and *then* the next district's briefing, in that order.

---

## 4. Act 1, Riverside: the five levels

Every mission owns a hand-authored `MapDef` under `src/data/maps/story/`, composed structurally with
`src/data/maps/compose.ts` rather than typed row by row. No two share a layout, and each is built around one
objective type chosen before the map was drawn. Since the Act 1 rework (ROADMAP #19) each also has its own
size, chosen for what the mission is about: small for a first mission, tall for pushing up a hill, long and
thin for a bridge.

Balance figures are AI-vs-AI (`npm run sim -- --map <id> --objective player --player-profile friendly`),
60 matches, each map's own shipped conditions and enemy profile, a fresh level-1 squad under the Balanced
auto-run AI. The sim gives the player **no gadgets and no gear**, so treat every number as a floor; a draw is
the sim's 40-turn cap (the real game has none). "Lost" is soldiers killed per run - under permadeath, the
number that matters most.

**Re-measured (ROADMAP #24).** Until then the sim silently forced midday and clear weather on every run, so
the earlier figures in this section were measured under the wrong conditions. The table is the corrected
one; Signal Fire and the Pumphouse were retuned as a result.

| # | Mission | Size | Objective | Conditions | Sim (player / enemy / draw) | Lost |
|---|---|---|---|---|---|---|
| 1 | **Lights Out** | 34×24 | `sabotage` ×2 | Afternoon, clear, `easy` | 82 / 8 / 10 | 1.5 |
| 2 | **Signal Fire** | 30×30 | `hold` ×5 rounds | Midnight, storm | 97 / 2 / 2 | 1.1 |
| 3 | **Cold Storage** | 46×22 | `reach` ×3 units | Midnight, fog | 97 / 0 / 3 | 0.7 |
| 4 | **The Pumphouse** | 30×40 | `sabotage` ×3 | Morning, rain, `easy` | 73 / 12 / 15 | 1.5 |
| 5 | **The Tollgate** | 62×16 | `eliminateTarget` | Afternoon, fog | 83 / 0 / 17 | 0.8 |

### 4.1 Lights Out — `lights-out`
**Beat.** The substation two blocks from the safehouse still has a working feeder. The Jackals fenced it
first. Get in, throw both breakers, and Riverside has light for the first time in three years.

**Teaches: pick your entry.** A chain-link fence cuts the map in half at x=12 with two ways through — a gate
at (12,11) that starts closed, and a torn breach at (12,18)–(12,19) that never does. The gate is short and
exposed; the breach is a long walk that drops you behind the transformer pens.

**Also teaches: split or commit.** The two breakers are at opposite corners — one inside the control building
in the north-east, one at the back of a transformer pen that is open along a single side.

**A deliberate reversal.** The control building's door starts *open*. An earlier draft sealed a sniper in with
Breaker A, which was atmospheric and wrong: the AI does not open doors, so it also made "eliminate every
enemy" unreachable until the player breached. Gating the alternate win condition behind a door is the wrong
lesson for mission 1. The optional route is the closed door here; the mandatory room is not.

**Ends with:** Abel Cortez climbs out of a basement where he has been rationing a case of water for nine days,
and asks who he has to shoot to stay.

### 4.2 Signal Fire — `signal-fire`
**Beat.** Power means the Kestrel Street relay can broadcast. Four rounds of carrier tone is enough for anyone
still listening to find us — and enough for every Jackal in the district to find the roof.

**Teaches: hold a line.** The whole map is one rooftop. The outer wall is the parapet; two internal parapets
split it into three bands connected only through seven numbered gaps. The squad starts *on* the objective, so
there is no approach phase: the hold can begin on turn one and the mission is the four rounds after that.

`holdRounds: 5` instead of the global default of 2 is what turns "hold" from a race into a siege. Six
attackers through five gaps from two directions is the pressure that number is calibrated against (on the
30×30 roof, four rounds was 95% wins and a seventh attacker 55%).

Midnight + storm is not set dressing: halved vision and −20 accuracy hurt the side crossing open roof far more
than the side behind a parapet, which is the only reason a 5-against-7 defence is winnable.

**Ends with:** the tone goes out into a city with nothing left to answer it. Nothing does, that night.
Something answers three days later, in code, from the Dockyards, and it is not friendly.

### 4.3 Cold Storage — `cold-storage`
**Beat.** Bellweather's packing plant has been sealed since the Blackout, which is another way of saying
nobody has eaten what is in it. The Jackals got there this morning.

**Teaches: doors are a decision.** Four halls, three dividing walls, two roller doors in each wall, one up
and one down. A closed door blocks sight as well as feet, so the down door in each wall is a route nobody is
watching. Since 10j the Jackals open doors too, so whoever opens one first picks where the next fight happens.

Freezer racks run north-south, across the line of advance, so there is no long lane through the building.
Night *and* fog is the first mission that punishes not bringing `flashlight` or `nvg`: between them they halve
both penalties.

**Ends with:** four hundred kilos of sealed protein and a working generator. Abel stops asking whether he can
stay.

### 4.4 The Pumphouse — `the-pumphouse`
**Beat.** Light and food, and still everybody is boiling river water. Dawes Street still has pressure in the
mains.

**Teaches: interactables are a system, not scenery.** Three valves have to be turned. One is out in the open
pipe gallery; two are inside settling tanks whose hatches start closed. There are two ways to open those
hatches:

- walk to each one and lever it — one action each, three separate approaches; or
- reach the sluice board at (26,12), in the control room at the east end of the tank farm, and throw the master switch, which is
  **linked to all three hatches** and opens them together.

The master switch is *not* one of the objective's three valves. It is a shortcut, not a step — and because a
switch toggles, throwing it after you have levered a hatch by hand shuts that one again.

The pipe gallery is staggered wall runs with offset gaps: nothing lines up, for shooting or for walking.

**Ends with:** water, brown for an hour and then clear. **And the first cinder-and-wrench sighting** — a
Halcyon maintenance sticker on the sluice board. Nobody in Riverside has heard the name.

### 4.5 The Tollgate — `the-tollgate`
**Beat.** Halloway has held the Kestrel Bridge since the second winter and taxes everything that crosses it,
which now includes us. There is no way around a bridge.

**Teaches: there is no flank.** The causeway is ten rows wide and sixty long, open water either side.
Three barricade lines cross it, each with its three-tile gaps in a different place, so advancing means
committing to a lane and then changing lanes under fire.

Halloway sits in the toll house on `camper` — he holds what he has rather than coming to meet you, which on a
map with no way around him means the mission ends where the map does. The ~27% draw rate in the sim is exactly
that: two AIs that will not dig each other out. A human will.

Fog is the counterweight to having nothing to flank through; a squad carrying `flashlight` halves it back
again, which is the first time the loadout screen visibly decides how a mission opens.

**Ends with:** Halloway dies at his own tollgate. Riverside is the first district in Ashport with power, water
and an open road. Word of that travels east.

---

## 5. Act 1, Market Row: the five levels

| # | Mission | Size | Objective | Conditions | Sim (player / enemy / draw) | Lost |
|---|---|---|---|---|---|---|
| 1 | **Supply Run: Market Row** | 56×24 | `reach` ×3 units | Morning, rain, `easy` | 70 / 10 / 20 | 1.5 |
| 2 | **The Clinic** | 32×26 | `hold` ×3 rounds | Afternoon, clear | 50 / 32 / 18 | 2.9 |
| 3 | **The Row Relay** | 40×36 | `sabotage` ×2 | Midnight, clear, `easy` | 62 / 8 / 30 | 1.4 |
| 4 | **The Night Market** | 36×36 | `eliminateTarget` | Midnight, cloudy | 38 / 55 / 7 | 3.6 |
| 5 | **The Jackals' Den** | 56×36 | `eliminateTarget` | Afternoon, cloudy | 23 / 27 / 50 | 3.3 |

These are a fresh level-1 squad's numbers; by Market Row a real squad has a level or two, gear and gadgets. The
Clinic and the Night Market are the two still worth a human playtest (see ROADMAP #19's own note).

### 5.1 Supply Run: Market Row — `supply-run-market-row`
A west-to-east run down a covered market street. Shopfronts top and bottom, each with one doorway; stall
islands for cover; the loading bay in the east corner.

`unitsRequired: 3`, not 5 — it is "get the crates out", not "get everybody out". Losing somebody is a setback,
not a restart. It is also the first mission low enough stakes to hand to auto-run (`P`), by design, and
deliberately the softest fight in the district.

**Ends with:** a name scratched into every crate lid. VEX. The Jackals are not scavengers picking over Market
Row. Somebody is running it.

### 5.2 The Clinic — `the-clinic`
**The inverse of Signal Fire.** There the squad started on the objective and had to survive; here the
dispensary console is in the far corner of a building the Jackals already hold, and the squad has to fight all
the way in before the hold can even start. Same objective type, opposite mission.

Five wards and a dispensary off two crossing corridors. Every ward is a closed room with one door — three open
and two shut — so part of the building is already awake and part of it is a decision. Three rounds rather than
four, because by the time the hold starts the squad has spent half its ammunition getting there.

**Ends with:** four people in the back ward who had been paying for antibiotics by the day. Two of them can
walk. One of them can shoot.

### 5.3 The Row Relay — `the-row-relay`
**The switch that closes things.** The two dock shutters start **open** — that is how the Jackals feed the
tower from the yard — and the breaker board at (12,28), right next to the squad's approach, is linked to both.
The dock wall also has a collapsed two-tile stretch that is always open (two one-tile doorways in a row were a
kill zone: 0% in the sim without it).
Throwing it drops both shutters and cuts the tower off. Throwing it again raises them.

Nothing in the objective requires it. It is purely the option to decide which half of the map the fight
happens in, and it is the first thing in the game that lets the player *remove* a route instead of opening
one. The tower itself is a loop around a solid stairwell core, with a transmitter room at each end.

**Ends with:** the Row goes quiet, and a frequency list taped inside a cabinet door — with one frequency that
is not a Jackal frequency, signed with a cinder over a wrench.

### 5.4 The Night Market — `the-night-market`
**The concealment mission.** A grid of tarpaulins — bush tiles, which are walkable, do not block line of
sight, and hide whoever stands in them until an observer gets within two tiles. At midnight, with vision
halved, the whole middle of the map becomes a place where both sides are nearby and neither knows where.

It is also where bush **exposure** bites: anything but moving while in a tarpaulin reveals the unit until its
own next phase. Shooting from concealment costs the concealment, and with six Jackals on the map that is
usually the whole trade. At 47% player / 43% enemy this is the hardest fight before the finale, on purpose.

Sable sits in the counting house on `camper` and does not wander into the tarpaulins, so this is a hunt
*through* cover toward a fixed point, not a hunt for a moving target.

**Ends with:** Sable's ledger. Not what the Jackals took — what they *handed over*, quarterly, marked PAID
under that same stamp.

### 5.5 The Jackals' Den — `jackals-den`
The act finale, and the biggest fight in the game. An approach yard, a freight warehouse, Vex's office behind
it, seven Jackals.

Every idea the act taught gets asked for once more. The dock wall has three doors — one up, two shut — so the
squad picks its breach (*Lights Out*). The shelving is single rows with a clear aisle behind each, so nothing
is a stalemate. The office is a walled box with one closed door at the far end, so the last thing the mission
asks is the first thing the act asked: open something and go in.

**Vex is a `tank` on the `camper` profile, not a bespoke stat block.** 24 HP and 3 armor behind a door already
reads as "the one you have to dig out", and `data/units.ts` has no per-instance stats to hang a boss on. The
roadmap's suggested "boss affix" turned out not to be needed.

**Balance, measured with the office door opened so the fight itself is visible to the sim (56×36 version):**
a fresh squad wins 4%, a level-3 squad 42% with only 2% losses (the rest are Vex camping out the turn cap,
which a human digs out). An act finale a starting squad can lose and a developed
one beats is the intended shape. Shipped, the office door is shut.

**Ends with:** Vex dead in his own office, and in his desk a fuel-tithe schedule, countersigned quarterly by
the Cinder Wardens of the Dockyards — above the mark of the company that used to run the lights.

---

## 6. The level-design method (for Acts 2 and 3)

Every Act 1 map follows the same five rules. Acts 2 and 3 should too.

1. **Objective first, map second.** Pick the objective type, then draw a map that only that objective would
   want. A `hold` map and a `reach` map should not be interchangeable.
2. **One thing each map teaches that no earlier map did.** Riverside: pick your entry → hold a line → doors
   are a decision → interactables are a system → there is no flank. Market Row: a soft run → the inverse of a
   hold → a switch that closes things → concealment → all of it at once.
3. **Conditions are mechanical, not decorative.** If a mission is at night, night has to be the reason it
   works — Signal Fire's defenders, Cold Storage's equipment check, the Night Market's concealment.
4. **High cover in lines, never in slabs.** An early Jackals' Den used double rows of shelving and ~60% of
   AI-vs-AI runs timed out because nothing could be flanked. Halving them fixed it, and the rule generalised.
5. **Enemy counts sit near parity.** The squad is always five. A big map buys distance and routes, not more
   bodies: the first pass at these maps used 8–10 enemies each and the sim showed 100% enemy wins across the
   board. Four to six is the working range, with six or seven reserved for a finale that expects levels. On a
   small map one extra enemy swings a lot: Signal Fire went from 95% to 55% with a seventh attacker.
6. **Size follows the idea** (added with the Act 1 rework). Every map has its own dimensions: small to fit
   the eye on a first mission, tall to push up through, long and ten tiles wide for a bridge with no flank,
   square for a market. 48×32 is no longer the default; nothing downstream assumes a size.
7. **Two-wide gaps, and never two single doorways in a row.** A one-tile gap in a wall is a kill zone for
   whoever is on overwatch behind it; two in sequence (a shutter, then a door) made the first Row Relay rework
   0% in the sim, and the first Pumphouse rework 7%. Openings the squad *has* to use are two tiles wide.

Then **balance-check with `npm run sim -- --map <id> --objective player --player-profile friendly`** (60+
matches, noise is about ±10 points at 60) and write the numbers into the map file's header comment before
calling it done. `npm run campaign-sim` then shows whether the act holds together as a campaign.

**Act 2's known beats**, for whoever writes them:

1. **Dockyards** — first contact with the Cinder Wardens. A checkpoint, run like a business. The coded
   transmission from Signal Fire came from here.
2. **Substation Hill** — the Wardens hold the high ground and the grid controls on it, and they are
   *maintaining* the switchgear, not stripping it. Somebody is keeping Ashport's grid alive and choosing not
   to switch it on.
3. **Old Town** — narrow streets, the ammo economy at its tightest, and the ledger trail finally naming
   Halcyon out loud.

Each district's briefing text is already written in `data/campaign.ts`; the missions are what is missing.

---

## 7. Supply runs: the generated pool

Supply runs are the repeatable job between story missions. They are generated, but not procedural: a run is a
**hand-authored 24×16 layout** plus three rolled dimensions, so no two offers read the same. They stay small
on purpose — a supply run is a job, not an operation, and the size difference is how the campaign screen tells
you which is which.

```
supply run = template (5 layouts) × complication (6) × enemy profile (difficulty tier) × callsign
```

`core/campaign.ts` keeps three offers on the board and guarantees **three different layouts** — the generator
draws from the templates not already in the pool. A finished run is retired and re-rolled.

### 7.1 The five layouts

| Template | Objective | Shape | Why it is in the pool |
|---|---|---|---|
| **Ardent Fuel Depot** | `reach` (3 units) | Tank farm. Almost no walls. | The open-ground one. Cover is everything, sightlines are brutal. |
| **Pharmacy Row** | `hold` | Six shopfronts, one street, one terminal. | The urban one. Close quarters, doorways, a fixed point. |
| **Halstead Rail Yard** | `sabotage` (2 releases) | Freight cars in rows; long lanes, no cross-flanks. | The corridor one. Two objectives you cannot flank between. |
| **Vance Street Underpass** | `reach` (3 units) | Two sealed levels joined by two one-tile gaps. | The chokepoint one. Whoever holds a gap holds the mission. |
| **Cold Creek Waterworks** | `eliminateTarget` | Settling tanks, one way into each. | The dig-them-out one. A named target in a bunker. |

One of each objective type the game has, twice over for `reach` — every supply run teaches a different verb.

### 7.2 The six complications

Each is a plain `MapDef` override plus a reward multiplier: a worse window pays better.

| Complication | Effect | Reward |
|---|---|---|
| Clear window | Nothing. The people there are the only problem. | ×1.0 |
| Downpour | Rain: slower movement, blurred sight and aim. | ×1.2 |
| Fog bank | Fog: vision cut hard, movement and aim mostly fine. | ×1.2 |
| Night drop | Midnight: vision roughly halved, −20 accuracy. | ×1.3 |
| Running dry | Half the usual reserve ammo — **for both sides**. | ×1.35 |
| Storm front | Late-afternoon storm: heavy accuracy *and* movement penalty. | ×1.45 |

"Running dry" being symmetric matters: it is a different mission, not a handicap.

### 7.3 Difficulty tiers

One step harder every three completed runs, capped at four tiers.

| Tier | Label | Enemy profiles |
|---|---|---|
| 0 | Light resistance | `easy`, `easy`, `standard` |
| 1 | Contested | `standard`, `standard`, `camper` |
| 2 | Dug in | `standard`, `hard`, `camper` |
| 3 | Hostile territory | `hard`, `hard`, `ambush` |

Sim check on the two layouts closest to symmetric:

| Map | `easy` (tier 0) | `standard` (tier 1+) |
|---|---|---|
| Pharmacy Row | player 98% | player 31% / enemy 39% |
| Vance Street Underpass | player 88% | player 28% / enemy 39% |

That gap is the intended curve: tier 0 is a warm-up, tier 1 onward expects the gear and levels banked by then.

---

## 8. Act 2: the Cinder Wardens

Fifteen missions, one file per district (`src/data/maps/story/dockyards.ts`, `substationHill.ts`, `oldTown.ts`);
each map's header comment has its design notes. Balance: the same sim as §4, with a **level-3 squad**
(`--player-level 3`), 50 matches. The Wardens fight differently from the Jackals: posted guards and bosses on
the `defend` profile (they hold a post rather than walk out to meet you - a `camper` leaves whenever it has no
shot), reinforcement waves, dormant garrisons, and in Old Town a reduced reserve for both sides.

**New verbs** (ROADMAP #20): `survive`, `defend` (the enemy has an objective, and it is yours), `retrieve`
(take something, then get out) and `eliminateTargets`.

### 8.1 Dockyards

| # | Mission | Size | Objective | Conditions | Sim (player / enemy / draw) | Lost |
|---|---|---|---|---|---|---|
| 1 | **The Checkpoint** | 40×24 | `retrieve` 2, extract 3 | Morning, fog, pods | 24 / 14 / 62 | 2.0 |
| 2 | **Low Tide** | 30×30 | `survive` 6 | Midnight, rain, waves r2/r4 | 100 / 0 / 0 | 1.6 |
| 3 | **The Harbourmasters** | 44×28 | `eliminateTargets` ×3 | Afternoon, clear, pods | 52 / 0 / 48 | 2.1 |
| 4 | **The Coded Signal** | 32×32 | `hold` 3 | Midnight, storm, wave r4 | 88 / 2 / 10 | 1.5 |
| 5 | **Dry Dock** | 54×30 | `eliminateTarget` (Marrow) | Afternoon, cloudy, wave r6 | 52 / 10 / 38 | 1.9 |

**The beat.** First contact. The Wardens run the waterfront like a business - receipts, schedules - and the
coded transmission that answered the Signal Fire turns out to be an automated handshake, sent every hour for
three years to a relay on Substation Hill: CONTRACT ACTIVE. The tithes all go one place, marked FOR MAINTENANCE.
New allies: Nell Aske, a ferry pilot.

### 8.2 Substation Hill

| # | Mission | Size | Objective | Conditions | Sim (player / enemy / draw) | Lost |
|---|---|---|---|---|---|---|
| 1 | **The Switchback** | 26×44 | `reach` 3 | Morning, cloudy | 86 / 0 / 14 | 1.7 |
| 2 | **Cold Feed** | 32×28 | `defend` 5 | Midnight, clear, waves r2/r4 | 84 / 16 / 0 | 0.7 |
| 3 | **The Maintenance Log** | 44×26 | `retrieve` 2, extract 3 | Afternoon, rain, wave r7 | 44 / 8 / 48 | 2.4 |
| 4 | **Breaker Yard** | 40×32 | `sabotage` ×3 | Morning, fog | 46 / 18 / 36 | 2.1 |
| 5 | **Hilltop Control** | 48×34 | `eliminateTargets` ×2 | Afternoon, cloudy, wave r7 | 46 / 0 / 54 | 1.8 |

**The beat.** The Wardens are maintaining the switchgear, not stripping it: the grid is energised, balanced, and
switched off at the last breaker. Every work order reads MAINTAIN - DO NOT ENERGISE - REF HS-114. The
superintendent's orders come from an office in Old Town under the cinder-and-wrench stamp. The first defend
(Cold Feed) relights Saint Brigid's.

### 8.3 Old Town

| # | Mission | Size | Objective | Conditions | Sim (player / enemy / draw) | Lost |
|---|---|---|---|---|---|---|
| 1 | **Narrow Streets** | 50×20 | `reach` 3 | Morning, fog, reserve ×0.7 | 52 / 0 / 48 | 1.5 |
| 2 | **The Bell Tower** | 36×36 | `eliminateTarget` (Brand) | Midday, clear, reserve ×0.7 | 38 / 26 / 36 | 3.5 |
| 3 | **The Armoury** | 38×28 | `retrieve` 2, extract 2 | Midnight, clear, reserve ×0.7, wave r6 | 62 / 20 / 18 | 2.4 |
| 4 | **Saint Oriel's** | 34×30 | `survive` 7 | Afternoon, storm, reserve ×0.75, waves r3/r5 | 100 / 0 / 0 | 1.0 |
| 5 | **Warden Command** | 52×34 | `eliminateTarget` (Vane) | Afternoon, cloudy, reserve ×0.85, wave r7 | 30 / 0 / 70 | 1.9 |

**The beat.** The ammunition squeeze, and the name said out loud: the armoury's supplier column reads HALCYON
SYSTEMS - SECURITY PROVISION - ACCOUNT HS-114. New ally: Mother Agnes Rook, who runs the resistance from a food
bank. The finale's files are the contract itself - the Wardens were never a militia, they are a contract nobody
cancelled, countersigned in Uptown.

## 9. Act 3: Halcyon Systems

Ten missions (`uptown.ts`, `spire.ts`), balanced with a **level-4 squad**. Halcyon's security is machines - the
**sentry** (bolted down, armored, sees nine tiles) and the **drone** (fast, fragile, sees nine tiles - at night
it finds you long before you see it) - plus the last Wardens on a Halcyon payroll.

### 9.1 Uptown

| # | Mission | Size | Objective | Conditions | Sim (player / enemy / draw) | Lost |
|---|---|---|---|---|---|---|
| 1 | **Glass Canyon** | 48×24 | `reach` 3 | Midday, clear | 96 / 0 / 4 | 1.5 |
| 2 | **The Contract Office** | 40×30 | `retrieve` 2, extract 3 | Midnight, clear, wave r6 | 58 / 4 / 38 | 1.0 |
| 3 | **The Blackout Archive** | 36×28 | `hold` 4 | Afternoon, rain, waves r3/r5 | 100 / 0 / 0 | 0.7 |
| 4 | **Security Perimeter** | 44×32 | `sabotage` ×3 | Morning, fog, wave r5 | 48 / 4 / 48 | 2.1 |
| 5 | **The Director** | 50×30 | `eliminateTarget` (Crane) | Afternoon, storm, wave r6 | 44 / 6 / 50 | 2.3 |

**The beat.** The proof. The contract renews itself each quarter unless an officer countermands it, and the signing
keys do it automatically. The archive logs show the Blackout minute by minute: a fault at 21:04, an engineer
asking to isolate it at 21:07, permission denied at 21:09 because isolation would register the fault against
Halcyon's own asset. Regional Director Harlan Crane kept the grid off for three years to keep the logs from an
inquiry. His card opens the Spire.

### 9.2 The Spire

| # | Mission | Size | Objective | Conditions | Sim (player / enemy / draw) | Lost |
|---|---|---|---|---|---|---|
| 1 | **Service Entrance** | 46×22 | `reach` 3 | Midnight, clear, wave r5 | 98 / 0 / 2 | 1.0 |
| 2 | **Floor Forty** | 34×30 | `defend` 5 | Midday, clear, waves r2/r4 | 98 / 2 / 0 | 1.4 |
| 3 | **The Cooling Plant** | 40×34 | `sabotage` ×3 | Afternoon, fog | 14 / 0 / 86 | 1.8 |
| 4 | **Lockdown** | 32×32 | `survive` 6 | Midnight, clear, waves r2/r4 | 100 / 0 / 0 | 1.0 |
| 5 | **Grid Control** | 44×36 | `hold` 4 | Afternoon, clear, waves r4/r5 | 76 / 24 / 0 | 3.4 |

**The beat.** Abel Cortez - recruited in Lights Out - opens the lift, the squad forces Grid Control onto manual,
survives the building's lockdown and holds the master console. At 21:04, three years to the minute, Abel closes
the first breaker by hand, and every Warden radio reads out CONTRACT HS-114 COUNTERMANDED BY AUTHORISED OFFICER.
The epilogue: seven keys on the console, one per district, four needed to switch anything off.

### 9.3 Reading the numbers

- **Draws** are the sim's 40-turn cap. The squad AI is slow at two-step objectives (retrieve) and at finding
  things in fog (the Cooling Plant, 90%+ draws), and a human has no cap - those maps are not "hard", the AI is
  just slow on them.
- **Lost** is what a mission costs. The survive and defend missions win almost every time and still cost one to
  two soldiers; finales cost two to three at the intended level.
- The finales are the hardest fight in their district by design (Dry Dock, Hilltop Control, Warden Command,
  The Director, Grid Control).
