import { GADGETS } from '../data/gadgets';
import type { GameEvent, GameState, Pos } from '../core/types';
import type { Floater } from '../render/renderer';

/**
 * Event playback (10d). The core resolves an action instantly and emits `GameEvent`s; this turns those events
 * into a short timeline of tracks - a unit walking its path, a tracer, a grenade arc and blast, a death fade -
 * and samples it every frame into an `AnimFrame` the renderer draws on top of (and instead of parts of) the
 * already-final state. Nothing here reads or changes rules; it only decides *when* the player sees each result.
 *
 * Fog: only events the player saw become tracks, an enemy's walk is only shown across tiles the player can see
 * right now, and a tracer from an attacker in the fog is drawn as an impact only (no line pointing back at it).
 */

/** Durations in ms at speed 1. `speed` divides them; 0 means instant (no tracks at all). */
export const TIMING = {
  step: 95, // one tile of walking
  shot: 170, // tracer travel
  shotGap: 110, // between shots of a burst
  throw: 380, // grenade arc
  blast: 420,
  death: 520,
  pulse: 650, // scan ring
  after: 60, // breathing room after any action
};

export interface Tracer { from: Pos; to: Pos; t: number; hit: boolean; fromHidden: boolean }
export interface Blast { at: Pos; radius: number; t: number }
export interface Arc { from: Pos; to: Pos; t: number }
export interface Pulse { at: Pos; radius: number; t: number }

/** What the renderer needs this frame. Positions are in (fractional) tiles. */
export interface AnimFrame {
  /** Where to draw a unit instead of its state position (walking, or waiting to walk). */
  pos: Map<number, Pos>;
  /** Damage already applied in the state but not yet "landed" on screen: add it back to the HP bar. */
  hpPending: Map<number, number>;
  /** Units the state already has down/dead whose moment hasn't come yet: draw them as they were. */
  upright: Set<number>;
  /** Dead units still fading out, 0..1 remaining opacity. */
  fading: Map<number, number>;
  tracers: Tracer[];
  blasts: Blast[];
  arcs: Arc[];
  pulses: Pulse[];
  shake: Pos;
}

/** Nothing playing: the board is exactly the state. */
export const emptyFrame = (): AnimFrame => ({
  pos: new Map(), hpPending: new Map(), upright: new Set(), fading: new Map(), tracers: [], blasts: [], arcs: [], pulses: [], shake: { x: 0, y: 0 },
});

type Track =
  | { k: 'walk'; unit: number; pts: Pos[]; start: number; end: number; from: number; to: number } // pts index range
  | { k: 'tracer'; from: Pos; to: Pos; hit: boolean; fromHidden: boolean; start: number; end: number }
  | { k: 'arc'; from: Pos; to: Pos; start: number; end: number }
  | { k: 'blast'; at: Pos; radius: number; start: number; end: number }
  | { k: 'pulse'; at: Pos; radius: number; start: number; end: number }
  | { k: 'impact'; unit: number; damage: number; start: number; end: number } // hp returns to state value at start
  | { k: 'fall'; unit: number; dies: boolean; start: number; end: number } // upright until start, fades if dies
  | { k: 'shake'; power: number; start: number; end: number };

/** Events that can happen *during* a walk (at one of its steps), as opposed to starting a new action. */
const WALK_EVENTS = new Set<GameEvent['t']>(['shot', 'pickup', 'downed', 'died', 'exposed', 'damage']);

const eq = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

/** `times[i]` is when `events[i]` is seen to happen - its log line waits for it. */
export interface Built { tracks: Track[]; floaters: Floater[]; times: number[]; end: number }

/**
 * Lays `events` out on a timeline starting at `t0`. Pure: exported for tests. `visible(p)` is the player's
 * current visibility (walks by enemies are clipped to it).
 */
export function buildTracks(events: GameEvent[], s: GameState, t0: number, speed: number, visible: (p: Pos) => boolean): Built {
  const tracks: Track[] = [];
  const floaters: Floater[] = [];
  const times: number[] = [];
  let t = t0;
  const d = (ms: number) => ms / speed;
  const float = (p: Pos, text: string, color: string, at: number) => floaters.push({ x: p.x, y: p.y, text, color, born: at });

  // The walk currently being laid out, so the events that happened mid-walk can be slotted in at their step.
  let walk: { unit: number; pts: Pos[]; idx: number } | null = null;
  const walkTo = (j: number) => {
    if (!walk || j <= walk.idx) return;
    const end = t + d(TIMING.step) * (j - walk.idx);
    tracks.push({ k: 'walk', unit: walk.unit, pts: walk.pts, start: t, end, from: walk.idx, to: j });
    walk.idx = j;
    t = end;
  };
  const closeWalk = () => {
    if (!walk) return;
    walkTo(walk.pts.length - 1);
    walk = null;
    t += d(TIMING.after);
  };

  for (const e of events) {
    if (walk && !WALK_EVENTS.has(e.t)) closeWalk();
    times.push(t); // corrected below for events whose moment is later than their start (a shot lands at its end)
    if (!e.seen) continue;

    // Mid-walk events carry the mover's position: walk up to that step first.
    if (walk && 'at' in e && e.at) {
      const at = e.at;
      const j = walk.pts.findIndex((p, i) => i >= walk!.idx && eq(p, at));
      if (j >= 0) { walkTo(j); times[times.length - 1] = t; }
    }

    switch (e.t) {
      case 'move': {
        const u = s.units[e.unit];
        let pts = [e.from, ...e.path];
        if (u.team === 'enemy') pts = pts.filter(visible); // never draw an enemy on a tile the player can't see
        if (pts.length >= 2) walk = { unit: e.unit, pts, idx: 0 };
        break;
      }
      case 'shot': {
        const fromHidden = s.units[e.attacker].team === 'enemy' && !visible(e.from);
        // A miss flies past the target rather than stopping on it.
        const to = e.hit ? e.at : { x: e.at.x + (e.at.x - e.from.x) * 0.15 + 0.3, y: e.at.y + (e.at.y - e.from.y) * 0.15 - 0.3 };
        const end = t + d(TIMING.shot);
        times[times.length - 1] = end;
        tracks.push({ k: 'tracer', from: e.from, to, hit: e.hit, fromHidden, start: t, end });
        if (e.hit) {
          tracks.push({ k: 'impact', unit: e.target, damage: e.damage, start: end, end: end + 1 });
          tracks.push({ k: 'shake', power: e.damage >= 6 ? 3 : 1.5, start: end, end: end + d(160) });
        }
        float(e.at, e.finishing ? 'FINISHED' : e.hit ? `-${e.damage}` : 'MISS', e.hit ? '#ff7a63' : '#b8b8a8', end);
        t = end + d(e.shot < e.shots ? TIMING.shotGap : TIMING.after);
        break;
      }
      case 'gadget': {
        const u = s.units[e.unit];
        const def = GADGETS[e.gadget];
        if (e.gadget === 'grenade' && e.target) {
          const land = t + d(TIMING.throw);
          times[times.length - 1] = land;
          tracks.push({ k: 'arc', from: u, to: e.target, start: t, end: land });
          tracks.push({ k: 'blast', at: e.target, radius: def.radius ?? 1, start: land, end: land + d(TIMING.blast) });
          tracks.push({ k: 'shake', power: 5, start: land, end: land + d(300) });
          t = land;
        } else if (e.gadget === 'scan' && e.target) {
          tracks.push({ k: 'pulse', at: e.target, radius: def.radius ?? 3, start: t, end: t + d(TIMING.pulse) });
          t += d(TIMING.pulse / 2);
        }
        break;
      }
      case 'damage': // grenade blast: lands with the blast that was just laid out
        tracks.push({ k: 'impact', unit: e.target, damage: e.amount, start: t, end: t + 1 });
        float(e.at, `-${e.amount}`, '#ff7a63', t);
        break;
      case 'downed':
        tracks.push({ k: 'fall', unit: e.unit, dies: false, start: t, end: t + 1 });
        float(e.at, 'DOWN', '#e6a23a', t + d(120));
        break;
      case 'died':
        tracks.push({ k: 'fall', unit: e.unit, dies: true, start: t, end: t + d(TIMING.death) });
        float(e.at, 'DEAD', '#e6e0c8', t + d(120));
        break;
      case 'heal':
      case 'revive':
        float(e.at, `+${e.amount}`, '#8fd19a', t);
        t += d(TIMING.after);
        break;
      case 'pickup':
        float(e.at, 'PICKED UP', '#c9a5d9', t);
        break;
    }
  }
  closeWalk();
  // A grenade's blast outlasts the moment its damage lands; the timeline ends when every track has.
  const end = Math.max(t, ...tracks.map((k) => k.end));
  return { tracks, floaters, times, end };
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const lerp = (a: Pos, b: Pos, k: number): Pos => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

export class Animator {
  private tracks: Track[] = [];
  private until = 0;

  /** Queue `events` after whatever is still playing. Returns the floaters they produce and when each event
   *  plays, both timed to match. */
  push(events: GameEvent[], s: GameState, now: number, speed: number, visible: (p: Pos) => boolean): { floaters: Floater[]; times: number[] } {
    if (speed <= 0) return buildTracks(events, s, now, Infinity, visible); // instant: numbers only, nothing to wait for
    this.tracks = this.tracks.filter((k) => k.end > now);
    const b = buildTracks(events, s, Math.max(now, this.until), speed, visible);
    this.tracks.push(...b.tracks);
    this.until = Math.max(this.until, b.end);
    return b;
  }

  /** ms until everything queued has played (0 when idle). */
  remaining(now: number): number {
    return Math.max(0, this.until - now);
  }

  clear() {
    this.tracks = [];
    this.until = 0;
  }

  frame(now: number): AnimFrame {
    const f = emptyFrame();
    // Walks: a unit whose first walk track hasn't started stands at its start; later ones at their own start.
    const firstWalk = new Map<number, Track & { k: 'walk' }>();
    for (const k of this.tracks) {
      if (k.k === 'walk' && !firstWalk.has(k.unit)) firstWalk.set(k.unit, k);
    }
    for (const k of this.tracks) {
      const p = (now - k.start) / Math.max(1, k.end - k.start);
      switch (k.k) {
        case 'walk': {
          if (now < k.start) { if (firstWalk.get(k.unit) === k) f.pos.set(k.unit, k.pts[k.from]); break; }
          // Finished: the state position takes over - unless the same unit walks again later (a walk split by
          // an overwatch shot, or a second move queued behind this one), in which case it waits here.
          if (now >= k.end) { if (this.laterWalk(k, now)) f.pos.set(k.unit, k.pts[k.to]); break; }
          const along = k.from + (k.to - k.from) * p;
          const i = Math.min(k.pts.length - 2, Math.floor(along));
          f.pos.set(k.unit, lerp(k.pts[i], k.pts[i + 1], along - i));
          break;
        }
        case 'impact':
          if (now < k.start) f.hpPending.set(k.unit, (f.hpPending.get(k.unit) ?? 0) + k.damage);
          break;
        case 'fall':
          if (now < k.start) f.upright.add(k.unit);
          else if (k.dies && now < k.end) f.fading.set(k.unit, 1 - p);
          break;
        case 'tracer':
          if (now >= k.start && now < k.end + 90) f.tracers.push({ from: k.from, to: k.to, t: Math.min(1, p), hit: k.hit, fromHidden: k.fromHidden });
          break;
        case 'arc':
          if (now >= k.start && now < k.end) f.arcs.push({ from: k.from, to: k.to, t: ease(p) });
          break;
        case 'blast':
          if (now >= k.start && now < k.end) f.blasts.push({ at: k.at, radius: k.radius, t: p });
          break;
        case 'pulse':
          if (now >= k.start && now < k.end) f.pulses.push({ at: k.at, radius: k.radius, t: p });
          break;
        case 'shake':
          if (now >= k.start && now < k.end) {
            const a = k.power * (1 - p);
            f.shake = { x: f.shake.x + Math.sin(now * 0.09) * a, y: f.shake.y + Math.cos(now * 0.113) * a };
          }
          break;
      }
    }
    return f;
  }

  /** True if `k`'s unit has another walk track that hasn't started yet. */
  private laterWalk(k: Track & { k: 'walk' }, now: number): boolean {
    return this.tracks.some((o) => o !== k && o.k === 'walk' && o.unit === k.unit && o.start >= k.end && now < o.start);
  }
}
