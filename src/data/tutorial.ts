/**
 * Guided-mode step data for the Training Grounds walkthrough (0f). Non-blocking: a step with a `trigger`
 * advances automatically the moment the player performs that action for real, anywhere on the map, in any
 * order; a step with no trigger just needs "Next". "Skip tutorial" dismisses the whole thing at any point.
 * `highlight`, when set, is a `data-b` action-bar button id to outline while that step is showing.
 */
export type TutorialTrigger = 'select' | 'move' | 'attack' | 'reload' | 'overwatch' | 'gadget' | 'interact' | 'endTurn' | null;

export interface TutorialStep {
  id: string;
  trigger: TutorialTrigger;
  prompt: string;
  highlight?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome', trigger: null,
    prompt: "Welcome to Offgrid. This walkthrough covers the basics - click Next, or just play and it'll keep up. Skip anytime." },
  { id: 'select', trigger: 'select',
    prompt: 'Click a unit - on the map, or its card in the roster on the right - to select it.' },
  { id: 'fog', trigger: null,
    prompt: "Darkened tiles are unseen. A unit hiding in a bush is only spotted by an observer within 2 tiles, or a scan." },
  { id: 'move', trigger: 'move', highlight: 'move',
    prompt: 'Click Move, then a highlighted tile. Standing next to cover (the shield icons) reduces incoming damage.' },
  { id: 'attack', trigger: 'attack', highlight: 'attack',
    prompt: 'Click Attack, then a visible enemy in range. Hover a target first to see your hit chance before committing.' },
  { id: 'reload', trigger: 'reload', highlight: 'reload',
    prompt: 'Reload refills your magazine from reserve ammo - only costs the action, nothing else.' },
  { id: 'overwatch', trigger: 'overwatch', highlight: 'overwatch',
    prompt: 'Overwatch reserves your weapon to fire automatically the next time an enemy moves or acts in your sight.' },
  { id: 'gadget', trigger: 'gadget', highlight: 'gadget',
    prompt: 'Every class carries a gadget - scan, grenade, medkit and more. Try using yours.' },
  { id: 'revive', trigger: null,
    prompt: "If a unit's HP hits 0, it goes down instead of dying. Move an ally next to it and use Revive before its bleed-out timer runs out." },
  { id: 'interact', trigger: 'interact', highlight: 'interact',
    prompt: 'Interact with the objective terminal, then hold that tile to capture it - moving away or dying breaks the hold.' },
  { id: 'endTurn', trigger: 'endTurn', highlight: 'endTurn',
    prompt: 'End Turn hands the phase to the enemy. You can also win by eliminating every enemy instead of capturing.' },
  { id: 'extras', trigger: null,
    prompt: 'Every key is rebindable in Settings, and a low-stakes mission can be handed to the squad with Auto-run.' },
  { id: 'done', trigger: null,
    prompt: "That's everything this walkthrough covers. Good luck out there." },
];
