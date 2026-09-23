import type { ButtonId } from './session';

/** Every action a key can be bound to: the action-bar buttons plus a handful of extra UI actions. */
export type BindableAction = ButtonId
  | 'toggleOverwatchView' | 'toggleAutoRun' | 'rotateCoverCW' | 'centerCamera' | 'zoomIn' | 'zoomOut'
  | 'selectUnit1' | 'selectUnit2' | 'selectUnit3' | 'selectUnit4' | 'selectUnit5';

/** Human-readable label for the settings screen. */
export const ACTION_LABEL: Record<BindableAction, string> = {
  move: 'Move', attack: 'Attack', reload: 'Reload', gadget: 'Gadget', overwatch: 'Overwatch',
  aid: 'First aid', revive: 'Revive', interact: 'Interact', endTurn: 'End turn',
  toggleOverwatchView: 'Overwatch view', toggleAutoRun: 'Auto-run', rotateCoverCW: 'Rotate cover',
  centerCamera: 'Centre camera', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
  selectUnit1: 'Select unit 1', selectUnit2: 'Select unit 2', selectUnit3: 'Select unit 3',
  selectUnit4: 'Select unit 4', selectUnit5: 'Select unit 5',
};

export const BINDABLE_ACTIONS = Object.keys(ACTION_LABEL) as BindableAction[];

export type KeyBindings = Record<BindableAction, string>;

/**
 * The shipped defaults - reproduces today's fixed layout exactly (regression-safe: a fresh player with no
 * saved bindings sees identical behaviour to before this feature existed).
 * Escape (cancel) is deliberately not in here: it's reserved (see RESERVED_KEY) and never rebindable, so a
 * player can never lock themselves out of canceling an action. Rotating cover the other way is always
 * Shift + rotateCoverCW's key, not an independently bindable action.
 */
export const DEFAULT_BINDINGS: KeyBindings = {
  move: 'm', attack: 'a', reload: 'r', gadget: 'g', overwatch: 'o', aid: 'f', revive: 'u', interact: 'i', endTurn: 'e',
  toggleOverwatchView: 'v', toggleAutoRun: 'p', rotateCoverCW: 'q', centerCamera: 'c', zoomIn: '=', zoomOut: '-',
  selectUnit1: '1', selectUnit2: '2', selectUnit3: '3', selectUnit4: '4', selectUnit5: '5',
};

/** A key no action may ever be bound to: it always means "cancel", both during a rebind capture and in play. */
export const RESERVED_KEY = 'Escape';

const STORAGE_KEY = 'offgrid.keybindings';

export function loadBindings(): KeyBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const saved = JSON.parse(raw) as Partial<Record<BindableAction, unknown>>;
    const out = { ...DEFAULT_BINDINGS };
    for (const a of BINDABLE_ACTIONS) if (typeof saved[a] === 'string') out[a] = saved[a] as string;
    return out;
  } catch {
    return { ...DEFAULT_BINDINGS }; // corrupt or inaccessible storage: fall back to shipped defaults
  }
}

export function saveBindings(b: KeyBindings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch { /* storage unavailable: just won't persist */ }
}

/** Normalizes a keyboard event to the string form bindings are stored/compared as. */
export const keyOf = (ev: KeyboardEvent): string => (ev.key.length === 1 ? ev.key.toLowerCase() : ev.key);

/** 'm' -> 'M', 'Escape'/'Enter' etc. stay as-is - for showing a bound key in the UI. */
export const displayKey = (key: string): string => (key.length === 1 ? key.toUpperCase() : key);
