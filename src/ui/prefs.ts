/**
 * Player preferences that aren't keybindings (10d-10f): presentation only, never rules. Stored like the
 * keybindings (localStorage, defaults on anything missing or corrupt, never throws).
 */
export interface Prefs {
  /** Multiplier on every animation (10d). 0 = instant. */
  animSpeed: number;
  /** Screen shake on hits and blasts (10d). */
  shake: boolean;
}

const KEY = 'offgrid.prefs';

const reducedMotion = (): boolean => {
  try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; }
};

/** Reduced-motion users start with instant playback and no shake; everyone can change it in Settings. */
export const defaultPrefs = (): Prefs => (reducedMotion() ? { animSpeed: 0, shake: false } : { animSpeed: 1, shake: true });

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
