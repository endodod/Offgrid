import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, RESERVED_KEY } from './keybindings';
import { actionUsing, getBindings, keyFor, rebindAction, resetBindings } from './input';

describe('rebinding (0e)', () => {
  beforeEach(() => resetBindings()); // input.ts's live bindings persist across tests otherwise

  it('starts from the shipped defaults', () => {
    expect(getBindings()).toEqual(DEFAULT_BINDINGS);
  });

  it('rebinds an action to a free key', () => {
    expect(rebindAction('move', 'w')).toBeNull();
    expect(keyFor('move')).toBe('w');
  });

  it('refuses the reserved (cancel) key', () => {
    expect(rebindAction('move', RESERVED_KEY)).toBe('reserved');
    expect(keyFor('move')).toBe(DEFAULT_BINDINGS.move); // unchanged
  });

  it('refuses a key already bound to a different action, and reports which one', () => {
    expect(rebindAction('move', DEFAULT_BINDINGS.attack)).toBe('attack');
    expect(keyFor('move')).toBe(DEFAULT_BINDINGS.move); // unchanged
  });

  it('allows rebinding an action to the key it already has (a no-op, not a self-conflict)', () => {
    expect(rebindAction('move', DEFAULT_BINDINGS.move)).toBeNull();
  });

  it('freeing up a key by moving it elsewhere lets another action take it', () => {
    rebindAction('move', 'w'); // 'm' is now free
    expect(rebindAction('attack', 'm')).toBeNull();
    expect(keyFor('attack')).toBe('m');
  });

  it('actionUsing finds the action bound to a key, excluding one given', () => {
    expect(actionUsing(DEFAULT_BINDINGS.attack)).toBe('attack');
    expect(actionUsing(DEFAULT_BINDINGS.attack, 'attack')).toBeNull();
    expect(actionUsing('zzz-unbound-key')).toBeNull();
  });

  it('resetBindings restores every action to its shipped default', () => {
    rebindAction('move', 'w');
    rebindAction('attack', 'x');
    resetBindings();
    expect(getBindings()).toEqual(DEFAULT_BINDINGS);
  });
});
