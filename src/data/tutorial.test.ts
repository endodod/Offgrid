import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS } from './tutorial';

// The subset of Action['type'] (core/actions.ts) a tutorial step may trigger on, kept as a literal list here
// rather than importing the type so this stays a pure data check with no core/ dependency.
const VALID_TRIGGERS: Set<string | null> = new Set(['select', 'move', 'attack', 'reload', 'overwatch', 'gadget', 'interact', 'endTurn', null]);
const VALID_HIGHLIGHTS: Set<string> = new Set(['move', 'attack', 'reload', 'gadget', 'overwatch', 'aid', 'revive', 'interact', 'endTurn']);

describe('tutorial step data', () => {
  it('every step has a unique id', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every trigger is a real action/event type, or null (info-only) or "select"', () => {
    for (const s of TUTORIAL_STEPS) expect(VALID_TRIGGERS.has(s.trigger)).toBe(true);
  });

  it('every highlight (when set) names a real action-bar button', () => {
    for (const s of TUTORIAL_STEPS) if (s.highlight) expect(VALID_HIGHLIGHTS.has(s.highlight)).toBe(true);
  });

  it('every step has non-empty prompt text', () => {
    for (const s of TUTORIAL_STEPS) expect(s.prompt.length).toBeGreaterThan(0);
  });

  it('covers every core action at least once (move/attack/reload/overwatch/gadget/interact/endTurn)', () => {
    const triggers: Set<string | null> = new Set(TUTORIAL_STEPS.map((s) => s.trigger));
    for (const t of ['move', 'attack', 'reload', 'overwatch', 'gadget', 'interact', 'endTurn']) expect(triggers.has(t)).toBe(true);
  });
});
