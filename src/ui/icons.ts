/**
 * Inline SVG icons, as strings.
 *
 * Deliberately not an icon font or a sprite sheet: the whole set is a few hundred bytes, every icon is drawn
 * with the same 24-box, 2px stroke and `currentColor`, and returning a string keeps them usable from the
 * `innerHTML` templates the rest of the UI is built from without adding a render step.
 */

export type IconName =
  | 'move' | 'attack' | 'reload' | 'gadget' | 'overwatch' | 'aid' | 'revive' | 'interact' | 'endTurn'
  | 'armor' | 'equipment' | 'perk' | 'ammo' | 'medkit' | 'currency'
  | 'play' | 'settings' | 'back' | 'close' | 'map' | 'base' | 'squad' | 'lock' | 'check' | 'eye' | 'bolt';

const PATHS: Record<IconName, string> = {
  // --- action bar ---
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3"/>',
  attack: '<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  reload: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>',
  gadget: '<path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
  overwatch: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  aid: '<path d="M12 6v12M6 12h12"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  revive: '<path d="M3 12h4l2-5 3 10 2.5-6 1.5 3h5"/>',
  interact: '<path d="M9 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11V7.5a1.5 1.5 0 0 1 3 0V13a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2a1.5 1.5 0 0 1 3 0"/>',
  endTurn: '<path d="M4 12h13"/><path d="M13 7l5 5-5 5"/><path d="M21 5v14"/>',

  // --- inventory / meta ---
  armor: '<path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-3Z"/>',
  equipment: '<path d="M14.7 6.3a4 4 0 0 0 5 5L15 16l-3.5 3.5a2.1 2.1 0 0 1-3-3L12 13Z"/><path d="m5 5 4 4"/>',
  perk: '<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9L6.7 19.6l1.1-6L3.4 9.4l6-.8Z"/>',
  ammo: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3M4 14h16"/>',
  medkit: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M12 11v5M9.5 13.5h5"/>',
  currency: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4"/>',

  // --- navigation ---
  play: '<path d="M7 4.5 19 12 7 19.5Z"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.6a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  back: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  map: '<path d="m9 4-6 3v13l6-3 6 3 6-3V4l-6 3Z"/><path d="M9 4v13M15 7v13"/>',
  base: '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>',
  squad: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 20a6.4 6.4 0 0 0-2.4-5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
};

/** An icon as an inline `<svg>` string. `cls` is appended to the element's class list. */
export function icon(name: IconName, cls = ''): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${PATHS[name]}</svg>`;
}
