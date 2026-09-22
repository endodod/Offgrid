# Ashport

The story bible. Premise, factions, the shape of all three acts, and a per-mission design sheet for every
level that actually exists in the build. ROADMAP.md tracks *features*; this file tracks *fiction and levels*.

Rule of thumb used throughout: **nothing here needs a narrative system.** Every beat is carried by a mission's
objective type, its map, its weather, or a line of text on the campaign screen. If a beat can only be told in
a cutscene, it gets cut or rewritten until a map can tell it.

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
| **The Jackals** (Act 1) | Scavenger raiders. No structure beyond whoever is currently frightening. | Whatever is not nailed down, and the people who are. | `easy` / `standard` profiles. Sloppy, aggressive, punished by patience. |
| **The Cinder Wardens** (Act 2) | An organised militia that carved the city into fiefs. Checkpoints, tithes, ledgers. | Fuel and food, taken on a schedule, from people who cannot refuse. | `camper` / `hard` / `ambush`. Fortified positions and prepared ground. |
| **Halcyon Systems** (Act 3) | The utility and security contractor that ran Ashport's grid before the Blackout. | To keep the outage from ever being attributed. | Not yet designed. |

**The twist**, seeded from the first mission and paid off in Act 3: the Cinder Wardens are Halcyon's
contracted enforcement arm, still running the last orders they were given, long after anyone was left to
countermand them. The Blackout was Halcyon's — a failure they chose not to fix because fixing it meant
admitting it. Every tithe ledger the player takes off a Warden is stamped with a cinder-and-wrench mark,
which is a Halcyon subcontractor stamp; the player sees it four times before anyone explains it.

---

## 3. Act structure

| Act | Districts | Antagonist | Shape |
|---|---|---|---|
| 1 | Riverside, Market Row | the Jackals | Teaches the loop: light a block, find a recruit, run a supply job, take out the local leader. Low stakes, on purpose. |
| 2 | Dockyards, Substation Hill, Old Town | the Cinder Wardens | Escalation. Fortified positions, patrol/turret AI profiles, and an ammo economy that actually bites. |
| 3 | Uptown, The Spire | Halcyon Systems | Payoff. The Wardens' command structure collapses once Halcyon is exposed; the last mission is retaking the Spire and handing grid control back to the districts. |

District order is linear: Riverside → Market Row → Dockyards → Substation Hill → Old Town → Uptown → The
Spire. Acts 2 and 3 have districts and a shape but **no missions written yet** — they are the next content
task, and `data/campaign.ts` already has the slots.

---

## 4. Act 1: the four levels, in detail

All four are built and playable. Each has its own `MapDef` under `src/data/maps/`, designed around its own
objective type — none of them share a layout, and none of them reuse Training Grounds.

Balance figures below are AI-vs-AI, from `npm run sim -- --map <id>`, which gives the player **no gadgets, no
gear and no levels**. A real player has all three, so treat these as a floor.

### 4.1 Lights Out — `lights-out` — `data/maps/lightsOut.ts`

| | |
|---|---|
| **District** | Riverside |
| **Objective** | `sabotage` — throw both breakers |
| **Map** | Riverside Substation, 24×16 |
| **Conditions** | Afternoon, clear. Enemy profile `easy`. |
| **Sim** | Player 79% / enemy 8% / draw 13% at its own `easy` profile. |

**Beat.** The substation two blocks from the safehouse still has a working feeder. The Jackals fenced it
first. Get in, throw both breakers, and Riverside has light for the first time in three years.

**Design.** The map is cut in half by a chain-link fence at x=11 with exactly two ways through: a gate at
(11,7) that starts **closed**, and a torn breach at (11,12)–(11,13) that is always open. That is the first
thing the mission teaches — not "walk forward", but "pick your entry". The gate is the fast, exposed route;
the breach is slow and drops you at the back of the compound.

Breaker A is in the control shack (switch 10, at (21,1)), Breaker B is at the back of a transformer pen that
is only open to the south (switch 11, at (22,13)). Two objectives at opposite corners means the squad has to
split or commit, which is the second thing it teaches.

**A deliberate reversal:** the shack door (21,4) starts **open**. An earlier draft sealed a sniper in there
with Breaker A, which was atmospheric and wrong — the AI does not open doors, so it also made "eliminate
every enemy" unreachable until the player breached. Gating the alternate win condition behind a door is the
wrong lesson for mission 1. The optional gate is the closed door here; the mandatory room is not.

**Ends with:** Abel Cortez climbs out of the basement where he has been rationing a case of water for nine
days, and asks who he has to shoot to stay. First recruit.

### 4.2 Signal Fire — `signal-fire` — `data/maps/signalFire.ts`

| | |
|---|---|
| **District** | Riverside |
| **Objective** | `hold`, `holdRounds: 4` |
| **Map** | Kestrel Street Rooftop, 24×16 |
| **Conditions** | Midnight, storm. Enemy profile `standard`. Six enemies. |
| **Sim** | Player 93% via objective in ~8 turns, but 19% of all units end downed and unrevived. |

**Beat.** Power means the Kestrel Street relay can broadcast. Four rounds of carrier tone is enough for
anyone still listening to find us — and enough for every Jackal in the district to find the roof.

**Design.** The whole map is one roof. The border wall is the parapet; the only ways up are four stairheads —
two in the north parapet (x=5, x=18), one west at (0,4), one east at (23,11). The squad starts *on* the
objective. There is no approach phase at all: you can start the hold on turn one, and the entire mission is
the four rounds after that.

`holdRounds: 4` instead of the global default of 2 is what converts "hold" from a race into a siege. Two
rounds is "get there first". Four is "survive what arrives". Six attackers against five defenders, from four
directions at once, is the pressure that number is calibrated against.

Midnight + storm is not set dressing. Halved vision and a −20 accuracy penalty hurt the side crossing open
roof far more than the side sitting in parapet cover, which is the only reason a 5-vs-6 defence is winnable —
and it means the mission about a light in the dark is played in the dark.

**Ends with:** the tone goes out. Nothing answers that night. Something answers three days later, in code,
from the Dockyards, and it is not friendly.

### 4.3 Supply Run: Market Row — `supply-run-market-row` — `data/maps/marketRow.ts`

| | |
|---|---|
| **District** | Market Row |
| **Objective** | `reach`, `unitsRequired: 3` |
| **Map** | Market Row, 24×16 |
| **Conditions** | Morning, rain. Enemy profile `easy`. |
| **Sim** | Player 83% / enemy 13% / draw 5%, ~11 turns. |

**Beat.** Abel says the covered market still has sealed crates under the collapsed awnings. Low stakes, high
value: get in, take what you can carry, be at the loading bay before the Jackals work out you are there.

**Design.** A straight west-to-east run down a covered market street. Shopfronts line the top and bottom, each
with one doorway onto the street; stalls make the cover islands in the middle; the extraction zone is the
loading bay in the east corner (seven `O` tiles).

`unitsRequired: 3`, not 5, is the point of the mission: it is "get the crates out", not "get everyone out".
Losing somebody on the way is a setback, not an automatic restart. This is also the first mission that is low
enough stakes to be worth handing to auto-run (`P`), which is by design.

The crates are ordinary pickups (ammo, medkits, a gadget charge) and nothing forces you to take them. Both
chests are inside shopfronts, and two of the five Jackals are sitting in shopfronts too — so the detour off
the straight line between spawn and exit is a real decision instead of free money.

**Ends with:** enough ammunition and gauze to matter, and a name scratched into every crate lid: **VEX**. The
Jackals are not scavengers picking over Market Row. Somebody is running it.

### 4.4 The Jackals' Den — `jackals-den` — `data/maps/jackalsDen.ts`

| | |
|---|---|
| **District** | Market Row |
| **Objective** | `eliminateTarget`, spawn index 0, "Vex, the Jackal leader" |
| **Map** | The Jackals' Den, 24×16 |
| **Conditions** | Afternoon, cloudy. Enemy profile `standard`. Leader on `camper`. |
| **Sim** | With the office opened so the fight is measurable: fresh squad 47%, level-3 squad 78%, level-5 squad 94%. |

**Beat.** Vex runs the district out of the freight warehouse on the east end. Take the district by taking him
— everything the Jackals have is held together by the fact that nobody has.

**Design.** An approach yard west, a warehouse east, one solid wall between them at x=8 with two loading-dock
doors. (8,11) is already rolled up, so the Jackals inside come out to meet you; (8,7) is shut, so there is a
second breach point you open on your own terms. Inside: four single rows of shelving, each with a clear aisle
behind it, and Vex's office walled off in the north-east corner behind one closed door at (21,5).

**Vex is a `tank` with the `camper` profile, not a new stat block.** 24 HP and 3 armor behind a door already
reads as "the one you have to dig out", and `data/units.ts` has no per-instance stats to hang a bespoke boss
on. The roadmap's suggested "boss affix" is not needed; the class table already contains a convincing boss.

**Balance history worth keeping:** the shelving was originally four *double* rows. Nothing could be flanked,
and ~60% of AI-vs-AI runs timed out. Halving it to single rows with an aisle behind each, and dropping the
squad from six to five, produced the progression curve above — which is the correct shape for an act finale:
a starting squad can lose it, a developed one beats it.

**Ends with:** Vex dies in his own office. The Jackals scatter within the week. In his desk is a fuel-tithe
ledger, stamped with a cinder-and-wrench mark nobody in Riverside recognises. *(First of four sightings of the
Halcyon subcontractor stamp — see §2.)*

---

## 5. Supply runs: the generated pool

Supply runs are the repeatable job between story missions. They are generated, but not procedural: a run is a
**hand-authored layout** plus three rolled dimensions, so no two offers read the same.

```
supply run = template (5 layouts) × complication (6) × enemy profile (difficulty tier) × callsign
```

`core/campaign.ts` keeps three offers on the board at a time and guarantees **three different layouts** — the
generator draws from the templates not already in the pool. A finished run is retired and re-rolled.

### 5.1 The five layouts

| Template | Objective | Shape | Why it is in the pool |
|---|---|---|---|
| **Ardent Fuel Depot** | `reach` (3 units) | Tank farm. Almost no walls. | The open-ground one. Cover is everything and sightlines are brutal. |
| **Pharmacy Row** | `hold` | Six shopfronts around one street and one terminal. | The urban one. Close quarters, doorways, a fixed point to defend. |
| **Halstead Rail Yard** | `sabotage` (2 releases) | Freight cars in rows; long lanes, no cross-flanks. | The corridor one. Two objectives at opposite ends of a map you cannot flank. |
| **Vance Street Underpass** | `reach` (3 units) | Two sealed levels joined by two one-tile gaps. | The chokepoint one. Whoever holds a gap holds the mission. |
| **Cold Creek Waterworks** | `eliminateTarget` | Settling tanks, one way into each. | The dig-them-out one. A named target in a bunker. |

That is one of each objective type the game has, twice over for `reach`, which is deliberate — every supply
run teaches a different verb.

### 5.2 The six complications

Each is a plain `MapDef` override plus a reward multiplier: a worse window pays better.

| Complication | Effect | Reward |
|---|---|---|
| Clear window | Nothing. The people there are the only problem. | ×1.0 |
| Night drop | Midnight: vision roughly halved, −20 accuracy. | ×1.3 |
| Downpour | Rain: slower movement, blurred sight and aim. | ×1.2 |
| Fog bank | Fog: vision cut hard, movement and aim mostly fine. | ×1.2 |
| Storm front | Late-afternoon storm: heavy accuracy *and* movement penalty. | ×1.45 |
| Running dry | Half the usual reserve ammo — **for both sides**. | ×1.35 |

"Running dry" being symmetric matters: it is a different mission, not a handicap.

### 5.3 Difficulty tiers

One step harder every three completed runs, capped at four tiers.

| Tier | Label | Enemy profiles |
|---|---|---|
| 0 | Light resistance | `easy`, `easy`, `standard` |
| 1 | Contested | `standard`, `standard`, `camper` |
| 2 | Dug in | `standard`, `hard`, `camper` |
| 3 | Hostile territory | `hard`, `hard`, `ambush` |

Sim check on the tier spread, using the two layouts closest to symmetric:

| Map | `easy` (tier 0) | `standard` (tier 1+) |
|---|---|---|
| Pharmacy Row | player 98% | player 31% / enemy 39% |
| Vance Street Underpass | player 88% | player 28% / enemy 39% |

That gap is the intended curve: tier 0 is a warm-up, tier 1 onward is a real fight that expects the gear and
levels the player has banked by then.

---

## 6. Acts 2 and 3 — not written yet

The districts exist in `data/campaign.ts` and the unlock mechanism advances through them, but no missions are
authored. When they are, the pattern from Act 1 is the one to follow:

- **One objective type per mission**, chosen first; the map is designed around it, never retro-fitted.
- **One thing the map teaches** that no earlier map did (Act 1: pick your entry → survive a siege → partial
  extraction → dig out a fortified target).
- **Conditions are mechanical, not decorative** — if it is at night, night has to be the reason it works.
- **Balance-check with `npm run sim -- --map <id>`** before calling it done, and write the numbers into the
  map file's header comment.

Act 2's known beats, for whoever writes them:

1. **Dockyards** — first contact with the Cinder Wardens. A checkpoint, run like a business. The coded
   transmission from Signal Fire came from here.
2. **Substation Hill** — the Wardens hold the high ground and the grid controls on it. This is where the
   player learns the Wardens are *maintaining* infrastructure, not just taxing it, which makes no sense yet.
3. **Old Town** — narrow streets, the ammo economy at its tightest, and the ledger trail from Vex's desk
   finally names Halcyon.
