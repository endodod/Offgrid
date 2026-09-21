import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BINDABLE_ACTIONS, DEFAULT_BINDINGS, displayKey, keyOf, loadBindings, RESERVED_KEY, saveBindings,
} from './keybindings';

function makeLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

describe('keybindings data', () => {
  beforeEach(() => vi.stubGlobal('localStorage', makeLocalStorageMock()));
  afterEach(() => vi.unstubAllGlobals());

  it('DEFAULT_BINDINGS covers every bindable action with a distinct key, and none is the reserved one', () => {
    for (const a of BINDABLE_ACTIONS) {
      expect(DEFAULT_BINDINGS[a]).toBeTruthy();
      expect(DEFAULT_BINDINGS[a]).not.toBe(RESERVED_KEY);
    }
    const keys = BINDABLE_ACTIONS.map((a) => DEFAULT_BINDINGS[a]);
    expect(new Set(keys).size).toBe(keys.length); // no two actions share a default key
  });

  it('loadBindings with nothing saved returns the defaults', () => {
    expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
  });

  it('saveBindings then loadBindings round-trips', () => {
    const changed = { ...DEFAULT_BINDINGS, move: 'w' };
    saveBindings(changed);
    expect(loadBindings()).toEqual(changed);
  });

  it('loadBindings falls back to defaults on corrupt storage', () => {
    localStorage.setItem('offgrid.keybindings', 'not valid json{{{');
    expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
  });

  it('loadBindings fills in missing actions from defaults (e.g. after an old save predates a new action)', () => {
    localStorage.setItem('offgrid.keybindings', JSON.stringify({ move: 'w' }));
    const b = loadBindings();
    expect(b.move).toBe('w');
    expect(b.attack).toBe(DEFAULT_BINDINGS.attack);
  });

  it('loadBindings never throws even if localStorage itself is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => loadBindings()).not.toThrow();
    expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
  });
});

describe('key normalization', () => {
  it('keyOf lowercases single characters but leaves named keys alone', () => {
    expect(keyOf({ key: 'M' } as KeyboardEvent)).toBe('m');
    expect(keyOf({ key: 'm' } as KeyboardEvent)).toBe('m');
    expect(keyOf({ key: 'Escape' } as KeyboardEvent)).toBe('Escape');
    expect(keyOf({ key: 'Enter' } as KeyboardEvent)).toBe('Enter');
  });

  it('displayKey uppercases single characters but leaves named keys alone', () => {
    expect(displayKey('m')).toBe('M');
    expect(displayKey('Escape')).toBe('Escape');
  });
});
