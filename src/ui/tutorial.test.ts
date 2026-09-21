import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS } from '../data/tutorial';
import { stepSatisfied } from './tutorial';

/**
 * Advances index through TUTORIAL_STEPS the way the real controller does: an info-only (null-trigger) step
 * only ever advances via an explicit "Next" click (never through stepSatisfied - that's the real class's
 * behaviour too, Next and the trigger check are separate code paths), everything else needs a matching action.
 * Stalls (returns early) on a wrong action, just like the real thing would just sit there.
 */
function playThrough(actionsInOrder: (string | 'select')[]): number {
  let index = 0;
  let selectedId: number | null = null;
  let lastSelectedId: number | null = null;
  let ai = 0;
  while (index < TUTORIAL_STEPS.length) {
    const step = TUTORIAL_STEPS[index];
    if (step.trigger === null) { index++; continue; } // simulates clicking Next on an info step
    const action = actionsInOrder[ai++];
    if (action === undefined) break;
    if (action === 'select') selectedId = (selectedId ?? 0) + 1;
    if (!stepSatisfied(step, action === 'select' ? undefined : action, selectedId, lastSelectedId)) break;
    index++;
    lastSelectedId = selectedId;
  }
  return index;
}

describe('tutorial sequencing (0f)', () => {
  it('stepSatisfied never fires for an info-only (null-trigger) step', () => {
    const infoStep = TUTORIAL_STEPS.find((s) => s.trigger === null)!;
    expect(stepSatisfied(infoStep, 'move', 1, null)).toBe(false);
    expect(stepSatisfied(infoStep, undefined, 1, null)).toBe(false);
  });

  it('stepSatisfied fires for a matching action type', () => {
    const moveStep = TUTORIAL_STEPS.find((s) => s.trigger === 'move')!;
    expect(stepSatisfied(moveStep, 'move', null, null)).toBe(true);
    expect(stepSatisfied(moveStep, 'attack', null, null)).toBe(false);
  });

  it('stepSatisfied\'s "select" trigger fires only on a genuinely new selection', () => {
    const selectStep = TUTORIAL_STEPS.find((s) => s.trigger === 'select')!;
    expect(stepSatisfied(selectStep, undefined, null, null)).toBe(false); // nothing selected
    expect(stepSatisfied(selectStep, undefined, 5, null)).toBe(true); // newly selected
    expect(stepSatisfied(selectStep, undefined, 5, 5)).toBe(false); // unchanged from last time this step checked
  });

  it('a scripted playthrough in the steps\' own order reaches the end', () => {
    const inOrder: string[] = [];
    for (const s of TUTORIAL_STEPS) if (s.trigger !== null) inOrder.push(s.trigger);
    const index = playThrough(inOrder);
    expect(index).toBe(TUTORIAL_STEPS.length); // every trigger-bearing step was satisfied in turn
  });

  it('unrelated actions do not advance a step (order matters, not just "something happened")', () => {
    // the first triggerable step is 'select'; feeding it a 'move' first should not satisfy it
    const firstTrigger = TUTORIAL_STEPS.findIndex((s) => s.trigger !== null);
    expect(stepSatisfied(TUTORIAL_STEPS[firstTrigger], 'move', null, null)).toBe(false);
  });
});
