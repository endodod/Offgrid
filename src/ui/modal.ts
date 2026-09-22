const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface ModalContent {
  /** Small all-caps line above the title, e.g. "Riverside · Act 1". */
  eyebrow?: string;
  title: string;
  /** One paragraph per entry. The first is styled as the lead. */
  body: string[];
  /** Label on the dismiss button. */
  cta?: string;
}

let dismiss: (() => void) | null = null;

/**
 * The one modal in the app: district briefings and mission debriefs. Resolves when it is dismissed, so
 * callers can queue two in a row (`await showModal(debrief); await showModal(nextBriefing)`) without owning
 * any sequencing state of their own.
 *
 * Deliberately not `<dialog>`: the game already manages its own screen stacking and z-index, and `<dialog>`'s
 * top-layer + backdrop would sit outside that and fight the tooltip layer.
 */
export function showModal(content: ModalContent): Promise<void> {
  close(); // a second briefing replaces the first rather than stacking
  return new Promise((resolve) => {
    const el = $('modal');
    el.innerHTML = `<div class="modal__box" role="dialog" aria-modal="true" aria-label="${content.title.replace(/"/g, '&quot;')}">
      ${content.eyebrow ? `<div class="modal__eyebrow">${content.eyebrow}</div>` : ''}
      <h2 class="modal__title">${content.title}</h2>
      <div class="modal__rule"></div>
      <div class="modal__body">${content.body.map((p) => `<p>${p}</p>`).join('')}</div>
      <div class="modal__foot"><button class="btn--primary" data-modal-close>${content.cta ?? 'Continue'}</button></div>
    </div>`;
    el.hidden = false;

    dismiss = () => { close(); resolve(); };
    el.addEventListener('click', onBackdropOrButton);
    window.addEventListener('keydown', onKey);
    el.querySelector<HTMLButtonElement>('[data-modal-close]')?.focus();
  });
}

function onBackdropOrButton(e: MouseEvent) {
  const el = $('modal');
  if (e.target === el || (e.target as HTMLElement).closest('[data-modal-close]')) dismiss?.();
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); dismiss?.(); }
}

function close() {
  const el = $('modal');
  el.removeEventListener('click', onBackdropOrButton);
  window.removeEventListener('keydown', onKey);
  el.hidden = true;
  el.innerHTML = '';
  dismiss = null;
}
