import type { MapDef } from '../data/trainingGrounds';
import { CLASSES } from '../data/units';
import { RULES } from '../data/rules';
import { GADGETS } from '../data/gadgets';
import { ITEMS } from '../data/items';
import { EQUIPMENT } from '../data/equipment';
import { refreshVision } from './vision';
import { blocksMove } from './grid';
import { holdRounds, objectiveComplete } from './objectives';
import { lootOnDeath } from './loot';
import { perkBonus } from './leveling';
import type { Cover, EventBody, GameEvent, GameOptions, GameState, Interactable, Pickup, Pos, Team, Terrain, Unit } from './types';

const TEAMS: Team[] = ['player', 'enemy'];

export function createGame(map: MapDef, seed = 1, options: Partial<GameOptions> = {}): GameState {
  const height = map.rows.length;
  const width = map.rows[0].length;
  const terrain: Terrain[] = [];
  const cover: (Cover | null)[] = [];
  const coverRot: number[] = [];
  let objective: Pos | null = null;
  const objectiveZone: Pos[] = [];
  map.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Map row ${y} has width ${row.length}, expected ${width}`);
    [...row].forEach((ch, x) => {
      terrain.push(ch === '#' ? 'wall' : ch === 'b' ? 'bush' : 'floor');
      cover.push(ch === 'h' ? 'high' : 'l123'.includes(ch) ? 'low' : null);
      coverRot.push('123'.includes(ch) ? Number(ch) : 0);
      if (ch === 'O') { if (!objective) objective = { x, y }; objectiveZone.push({ x, y }); }
    });
  });
  const objectiveDef = map.objective ?? (objective ? { type: 'hold' as const } : null);

  const reserveMult = options.reserveMult ?? map.reserveMult ?? 1; // symmetric map scarcity (4): both teams
  // Base-building bonuses (6) are the player's own home-base upgrades, so - unlike reserveMult above - these
  // apply to the player's squad only, never the enemy's.
  const playerReserveMult = options.playerReserveMult ?? map.playerReserveMult ?? 1;
  const medkitBonus = options.medkitBonus ?? map.medkitBonus ?? 0;
  const gadgetUsesBonus = options.gadgetUsesBonus ?? map.gadgetUsesBonus ?? 0;
  const units: Unit[] = [];
  for (const team of TEAMS) {
    const forPlayer = team === 'player';
    // The campaign squad (13) takes the player spawn tiles in order, whatever class they were authored as.
    const spawns = forPlayer && map.squad
      ? map.squad.slice(0, map.spawns.player.length).map((m, i) => [m.cls, map.spawns.player[i][1], map.spawns.player[i][2]] as const)
      : map.spawns[team];
    for (const [i, [cls, x, y, aiProfile]] of spawns.map((sp, i) => [i, sp] as const)) {
      const def = CLASSES[cls];
      // Equipment (7) and leveling (8): only the player squad starts with a loadout/progress (enemies never
      // carry gear or perks in v1).
      const member = forPlayer ? map.squad?.[i] : undefined;
      const loadout = member?.loadout;
      const progress = member?.progress;
      const equippedPerks = progress ? [...progress.equippedPerks] : [];
      // Carried items that change starting supplies (11): the med pouch and the bandolier.
      const gear = (loadout?.equipment ?? []).flatMap((id) => (id ? [EQUIPMENT[id]] : []));
      const gearMedkits = gear.reduce((n, e) => n + (e.medkitBonus ?? 0), 0);
      const gearReserve = gear.reduce((n, e) => n + (e.reserveBonus ?? 0), 0);
      const startHp = member?.hp;
      units.push({
        id: units.length, team, cls, x, y,
        hp: startHp === undefined ? def.hp : Math.max(1, Math.min(def.hp, startHp)), ammo: def.weapon.magazine,
        reserve: Math.round(def.reserve * reserveMult * ((forPlayer ? playerReserveMult : 1) + gearReserve)),
        medkits: RULES.medkitsPerUnit + (forPlayer ? medkitBonus : 0) + perkBonus(equippedPerks).medkitBonus + gearMedkits,
        actions: 0, alive: true, downed: false, bleedOut: 0, overwatch: false, exposed: false, moveBonus: 0,
        gadget: forPlayer ? { id: def.gadget, uses: RULES.gadgetUsesPerMission + gadgetUsesBonus, cooldown: 0 } : null,
        armor: loadout?.armor ?? null, equipment: loadout ? [...loadout.equipment] : [null, null],
        xp: progress?.xp ?? 0, level: progress?.level ?? 1, perkPool: progress ? [...progress.perkPool] : [], equippedPerks,
        dmgDealt: 0, dmgTaken: 0, kills: 0, revives: 0, reserveUsed: 0, ranDry: false, shotsFired: 0, shotsHit: 0, aiProfile,
        ...(member ? { soldierId: member.soldierId, name: member.name } : {}),
      });
    }
  }

  if (options.enemyPods ?? map.enemyPods) assignPods(units.filter((u) => u.team === 'enemy'));

  const interactables: Interactable[] = (map.interactables ?? []).map((it) => ({ ...it, active: it.active ?? false }));
  const pickups: Pickup[] = (map.pickups ?? []).map((p) => ({ ...p, amount: p.amount ?? ITEMS[p.type].defaultAmount }));

  const emptyMemory = () => ({ lastSeen: {}, objectiveSeen: false, searchIndex: 0, doors: {} });
  const s: GameState = {
    map, width, height, terrain, cover, coverRot, capture: null, objective, objectiveZone, objectiveDef, interactables, pickups, units,
    phase: 'player', turn: 1, scans: [], seed, rng: seed, winner: null, fogEnabled: true,
    timeOfDay: options.timeOfDay ?? map.startTimeOfDay ?? 'midday',
    weather: options.weather ?? map.startWeather ?? 'clear',
    aiProfiles: {
      player: options.playerProfile ?? 'standard',
      enemy: options.enemyProfile ?? map.enemyProfile ?? 'standard',
    },
    options: { objectiveCapture: RULES.objectiveCapture, ...options },
    visible: { player: new Uint8Array(width * height), enemy: new Uint8Array(width * height) },
    seenUnits: { player: new Set(), enemy: new Set() },
    memory: { player: emptyMemory(), enemy: emptyMemory() },
    events: [],
  };
  startPhase(s, 'player');
  return s;
}

/** How close (in tiles) two enemy spawns must be to share a pod (10j). */
export const POD_RADIUS = 6;

/**
 * 10j: groups enemies into pods by where they start - anyone within POD_RADIUS of a pod member joins it - and
 * puts every one of them to sleep. A pod wakes together (core/ai.ts `wakePods`).
 */
function assignPods(enemies: Unit[]) {
  let next = 0;
  for (const u of enemies) {
    if (u.pod !== undefined) continue;
    const pod = next++;
    const queue = [u];
    u.pod = pod;
    for (let h = 0; h < queue.length; h++) {
      for (const o of enemies) {
        if (o.pod === undefined && Math.max(Math.abs(o.x - queue[h].x), Math.abs(o.y - queue[h].y)) <= POD_RADIUS) { o.pod = pod; queue.push(o); }
      }
    }
  }
  for (const u of enemies) u.dormant = true;
}

/**
 * 10j: a reinforcement wave (`MapDef.reinforcements`) due at the start of this enemy phase. Each spawn becomes
 * a new enemy unit, awake and with a full set of actions, on its tile - or, if that tile is taken, the nearest
 * free one within 2. Always announced (the arrival is heard, even when it isn't seen).
 */
function arriveReinforcements(s: GameState) {
  const waves = (s.map.reinforcements ?? []).filter((w) => w.turn === s.turn);
  if (!waves.length) return;
  const arrived: number[] = [];
  for (const [cls, x0, y0, aiProfile] of waves.flatMap((w) => w.spawns)) {
    const at = freeTileNear(s, x0, y0, 2);
    if (!at) continue;
    const def = CLASSES[cls];
    const reserveMult = s.options.reserveMult ?? s.map.reserveMult ?? 1;
    const u: Unit = {
      id: s.units.length, team: 'enemy', cls, x: at.x, y: at.y,
      hp: def.hp, ammo: def.weapon.magazine, reserve: Math.round(def.reserve * reserveMult), medkits: RULES.medkitsPerUnit,
      actions: RULES.actionsPerTurn, alive: true, downed: false, bleedOut: 0, overwatch: false, exposed: false, moveBonus: 0,
      gadget: null, armor: null, equipment: [null, null], xp: 0, level: 1, perkPool: [], equippedPerks: [],
      dmgDealt: 0, dmgTaken: 0, kills: 0, revives: 0, reserveUsed: 0, ranDry: false, shotsFired: 0, shotsHit: 0, aiProfile,
    };
    s.units.push(u);
    arrived.push(u.id);
  }
  if (!arrived.length) return;
  refreshVision(s);
  emit(s, { t: 'reinforce', units: arrived }, true);
}

/** The nearest tile to (x, y), within `r`, that nothing blocks and no living unit stands on. */
function freeTileNear(s: GameState, x: number, y: number, r: number): Pos | null {
  for (let d = 0; d <= r; d++) {
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      const nx = x + dx, ny = y + dy;
      if (!blocksMove(s, nx, ny) && !s.units.some((u) => u.alive && u.x === nx && u.y === ny)) return { x: nx, y: ny };
    }
  }
  return null;
}

/** Re-seed the RNG stream without touching the rest of the state. */
export function reseed(s: GameState, seed: number) {
  s.seed = seed;
  s.rng = seed;
}

/** Resets per-phase unit state, ticks cooldowns and scans for the team whose phase is starting. */
export function startPhase(s: GameState, team: Team) {
  s.phase = team;
  for (const u of s.units) {
    if (u.team !== team) continue;
    u.actions = RULES.actionsPerTurn;
    u.moveBonus = 0;
    u.exposed = false; // the bush cover comes back
    u.overwatch = false; // overwatch lasts through the other team's phase only
    if (u.gadget && u.gadget.cooldown > 0) u.gadget.cooldown--;
  }
  for (const sc of s.scans) if (sc.team === team) sc.turnsLeft--;
  s.scans = s.scans.filter((sc) => sc.turnsLeft > 0);
  refreshVision(s);
  emit(s, { t: 'phase', team, turn: s.turn }, true);
  tickCapture(s, team);
}

/** A downed unit dies for good once its own team's phase has started `bleedOutRounds` times without a revive. */
function tickBleedOut(s: GameState, team: Team) {
  for (const u of s.units) {
    if (u.team !== team || !u.downed) continue;
    u.bleedOut--;
    if (u.bleedOut <= 0) {
      u.alive = false;
      u.downed = false;
      emit(s, { t: 'died', unit: u.id, at: { x: u.x, y: u.y } }, [u]);
      lootOnDeath(s, u); // loot (7): a second death path from combat.ts's finalizeDeath - see lootOnDeath's own doc
    }
  }
}

export function checkWin(s: GameState) {
  if (s.winner) return;
  const alive = (team: Team) => s.units.some((u) => u.alive && u.team === team);
  if (!alive('player') && !alive('enemy')) declareWinner(s, 'draw');
  else if (!alive('player')) declareWinner(s, 'enemy');
  else if (!alive('enemy')) declareWinner(s, 'player');
  // The other objective types (3) resolve here; 'hold' wins through tickCapture below instead, once its own
  // round counter runs out - so objectiveComplete() deliberately never reports 'hold' as complete.
  else if (objectiveComplete(s)) declareWinner(s, 'player');
}

// ---------- objective: interact, then hold ----------

export function beginCapture(s: GameState, u: Unit) {
  s.capture = { team: u.team, unit: u.id, at: { x: u.x, y: u.y }, roundsLeft: holdRounds(s) };
  emit(s, { t: 'capture', unit: u.id, status: 'start', roundsLeft: s.capture.roundsLeft }, true);
}

/** The hold is broken if the unit dies, goes down, or leaves its tile. */
export function checkCapture(s: GameState) {
  const c = s.capture;
  if (!c) return;
  const u = s.units[c.unit];
  if (u.alive && !u.downed && u.x === c.at.x && u.y === c.at.y) return;
  s.capture = null;
  emit(s, { t: 'capture', unit: c.unit, status: 'broken', roundsLeft: c.roundsLeft }, true);
}

/** One round of holding passes at the start of the capturing team's phase; 0 rounds left wins. */
function tickCapture(s: GameState, team: Team) {
  checkCapture(s);
  const c = s.capture;
  if (!c || c.team !== team || s.winner) return;
  c.roundsLeft--;
  if (c.roundsLeft <= 0) declareWinner(s, team);
  else emit(s, { t: 'capture', unit: c.unit, status: 'progress', roundsLeft: c.roundsLeft }, true);
}

export function declareWinner(s: GameState, winner: Team | 'draw') {
  s.winner = winner;
  emit(s, { t: 'end', winner }, true);
}

export function endTurn(s: GameState) {
  const next: Team = s.phase === 'player' ? 'enemy' : 'player';
  if (next === 'player') s.turn++;
  startPhase(s, next);
  if (next === 'enemy') arriveReinforcements(s);
  // Not part of startPhase: it also runs once from createGame's initial phase, before any unit could be downed
  // or a side eliminated, and single-team test scenarios (no opposing spawns) rely on that being a no-op.
  tickBleedOut(s, next);
  checkWin(s);
}

/** Log an event. `seen` is derived from what the player team can currently see of the things involved. */
export function emit(s: GameState, body: EventBody, seen: boolean | (Unit | Pos)[]): GameEvent {
  const ev = { ...body, seen: false } as GameEvent;
  ev.seen = typeof seen === 'boolean' ? seen : seen.some((w) => isSeenByPlayer(s, w));
  s.events.push(ev);
  return ev;
}

export function isSeenByPlayer(s: GameState, w: Unit | Pos): boolean {
  if ('id' in w) return w.team === 'player' || s.seenUnits.player.has(w.id);
  return s.visible.player[w.y * s.width + w.x] === 1;
}

export const gadgetDef = (u: Unit) => (u.gadget ? GADGETS[u.gadget.id] : null);
