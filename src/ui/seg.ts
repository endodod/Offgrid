export interface SegOption {
  value: string;
  label: string;
  title?: string;
}

/**
 * A segmented control: the app's replacement for `<select>`.
 *
 * Every choice is visible and is its own 34px-plus button, which is the point - a dropdown hides the options,
 * needs two interactions to change one, and is the one control on a game screen that never looks like it
 * belongs. Returns a setter so the caller can re-sync the highlight when state changes elsewhere (the debug
 * panel's weather can be changed by loading a map, not just by clicking here).
 */
export function seg(el: HTMLElement, options: SegOption[], current: string, onPick: (value: string) => void): (value: string) => void {
  const paint = (value: string) => {
    el.innerHTML = options.map((o) =>
      `<button type="button" data-seg="${o.value}" aria-pressed="${o.value === value}"${o.title ? ` title="${o.title.replace(/"/g, '&quot;')}"` : ''}>${o.label}</button>`,
    ).join('');
  };
  el.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-seg]');
    if (!btn) return;
    paint(btn.dataset.seg!);
    onPick(btn.dataset.seg!);
  });
  paint(current);
  return paint;
}
