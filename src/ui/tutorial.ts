import { TUTORIAL_STEPS, type TutorialStep } from '../data/tutorial';
import type { Session } from './session';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const DISMISSED_KEY = 'offgrid.tutorial.dismissed';

export const tutorialDismissed = (): boolean => {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
};

/**
 * Pure sequencing rule, factored out so it's unit-testable without a DOM: does `step`'s trigger fire given
 * the most recent manually-performed action's type and the selection state? A step with no trigger (`null`)
 * never auto-advances - it waits for an explicit Next click.
 */
export function stepSatisfied(step: TutorialStep, lastActionType: string | undefined, selectedId: number | null, lastSelectedId: number | null): boolean {
  if (!step.trigger) return false;
  if (step.trigger === 'select') return selectedId !== null && selectedId !== lastSelectedId;
  return lastActionType === step.trigger;
}

/**
 * Guided-mode controller: walks `data/tutorial.ts`'s steps, watching `session.lastAction`/`selectedId` for
 * the current step's trigger. Never blocks play - a step just sits there until satisfied or skipped.
 *
 * `currentHighlight` is read by Hud on every render rather than this class touching the action-bar DOM
 * directly: the action bar's buttons are rebuilt (innerHTML) on every Hud.update(), which would silently
 * wipe out a class added here the moment the next state change re-renders it (the same class of bug the
 * 0a tooltip work hit with hover state, for the same underlying reason).
 */
export class Tutorial {
  active = false;
  private index = 0;
  private lastSelectedId: number | null = null;

  /** `onStepChange`: called after the step (and so `currentHighlight`) changes - the caller should re-render
   *  the Hud, since the action bar it lives in isn't otherwise rebuilt by clicking Next/Skip. */
  constructor(private session: Session, private onStepChange: () => void) {
    $('tutorial-next').addEventListener('click', () => { this.advance(); this.onStepChange(); });
    $('tutorial-skip').addEventListener('click', () => { this.finish(); this.onStepChange(); });
  }

  get currentHighlight(): string | null {
    return this.active ? (TUTORIAL_STEPS[this.index]?.highlight ?? null) : null;
  }

  start() {
    this.active = true;
    this.index = 0;
    this.lastSelectedId = this.session.selectedId;
    this.render();
    this.onStepChange();
  }

  /** Call after every session.onChange - cheap no-op when inactive or the step has no trigger to watch for. */
  onSessionChange() {
    if (!this.active) return;
    const step = TUTORIAL_STEPS[this.index];
    if (step && stepSatisfied(step, this.session.lastAction?.type, this.session.selectedId, this.lastSelectedId)) this.advance();
  }

  private advance() {
    this.index++;
    if (this.index >= TUTORIAL_STEPS.length) return this.finish();
    this.lastSelectedId = this.session.selectedId;
    this.render();
  }

  private finish() {
    this.active = false;
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* no persistence, just no longer auto-starts */ }
    $('tutorial-box').hidden = true;
  }

  /** Hides an in-progress tutorial without marking it dismissed - for leaving to a mission it doesn't cover. */
  hide() {
    this.active = false;
    $('tutorial-box').hidden = true;
  }

  private render() {
    const step = TUTORIAL_STEPS[this.index];
    $('tutorial-box').hidden = false;
    $('tutorial-text').textContent = step.prompt;
    $('tutorial-progress').textContent = `${this.index + 1} / ${TUTORIAL_STEPS.length}`;
  }
}
