import { SQUAD_ORDERS, type AiProfileId } from '../data/aiProfiles';

/**
 * Player preferences that aren't keybindings (10d-10f): presentation only, never rules. Stored like the
 * keybindings (localStorage, defaults on anything missing or corrupt, never throws).
 */
export interface Prefs {
  /** Multiplier on every animation (10d). 0 = instant. */
  animSpeed: number;
  /** Screen shake on hits and blasts (10d). */
  shake: boolean;
  /** Sound effects volume, 0..1 (10e). */
  volume: number;
  /** Blue/orange team colours instead of green/red (10f). */
  colorblind: boolean;
  /** Ask before ending a turn while units still have actions (10h). */
  confirmEndTurn: boolean;
  /** Moving rain, fog banks and lightning on the board (10i). Off leaves the still tint and haze. */
  weatherFx: boolean;
  /** The order auto-run plays the squad under (16): one of data/aiProfiles.ts's SQUAD_ORDERS. */
  autoMode: AiProfileId;
}

const KEY = 'offgrid.prefs';

const reducedMotion = (): boolean => {
  try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; }
};

/** Reduced-motion users start with instant playback, no shake and still weather; everyone can change it in Settings. */
export const defaultPrefs = (): Prefs => ({ ...(reducedMotion() ? { animSpeed: 0, shake: false, weatherFx: false } : { animSpeed: 1, shake: true, weatherFx: true }), volume: 0.7, colorblind: false, confirmEndTurn: true, autoMode: 'friendly' });

let prefs: Prefs = load();

function load(): Prefs {
  const d = defaultPrefs();
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Partial<Prefs>;
    return {
      animSpeed: typeof o.animSpeed === 'number' && o.animSpeed >= 0 ? o.animSpeed : d.animSpeed,
      shake: typeof o.shake === 'boolean' ? o.shake : d.shake,
      colorblind: typeof o.colorblind === 'boolean' ? o.colorblind : d.colorblind,
      weatherFx: typeof o.weatherFx === 'boolean' ? o.weatherFx : d.weatherFx,
      autoMode: SQUAD_ORDERS.includes(o.autoMode as AiProfileId) ? (o.autoMode as AiProfileId) : d.autoMode,
      confirmEndTurn: typeof o.confirmEndTurn === 'boolean' ? o.confirmEndTurn : d.confirmEndTurn,
      volume: typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1 ? o.volume : d.volume,
    };
  } catch {
    return d;
  }
}

export const getPrefs = (): Prefs => prefs;

export function setPrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable: just won't persist */ }
}
