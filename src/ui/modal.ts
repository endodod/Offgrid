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

export interface ConfirmContent extends ModalContent {
  /** Label on the cancel button (default "Cancel"). `cta` labels the confirm button. */
  cancel?: string;
  /** Style the confirm button as destructive. */
  danger?: boolean;
}

let dismiss: ((confirmed: boolean) => void) | null = null;

/**
 * The one modal in the app: district briefings, mission debriefs and confirmations. Resolves when it is
 * dismissed, so callers can queue two in a row (`await showModal(debrief); await showModal(nextBriefing)`)
 * without owning any sequencing state of their own.
 *
 * Deliberately not `<dialog>`: the game already manages its own screen stacking and z-index, and `<dialog>`'s
 * top-layer + backdrop would sit outside that and fight the tooltip layer.
 */
export function showModal(content: ModalContent): Promise<void> {
  return open(content, null).then(() => undefined);
}

/** In-game replacement for `confirm()`: resolves true on the confirm button or Enter, false on cancel, Esc or the backdrop. */
export function confirmModal(content: ConfirmContent): Promise<boolean> {
  return open(content, content.cancel ?? 'Cancel', content.danger);
}

function open(content: ModalContent, cancel: string | null, danger = false): Promise<boolean> {
  close(); // a second modal replaces the first rather than stacking
  return new Promise((resolve) => {
    const el = $('modal');
    el.innerHTML = `<div class="modal__box" role="dialog" aria-modal="true" aria-label="${content.title.replace(/"/g, '&quot;')}">
      ${content.eyebrow ? `<div class="modal__eyebrow">${content.eyebrow}</div>` : ''}
      <h2 class="modal__title">${content.title}</h2>
      <div class="modal__rule"></div>
      <div class="modal__body">${content.body.map((p) => `<p>${p}</p>`).join('')}</div>
      <div class="modal__foot">
        ${cancel ? `<button class="btn--ghost" data-modal-cancel>${cancel}</button>` : ''}
        <button class="${danger ? 'btn--danger' : 'btn--primary'}" data-modal-close>${content.cta ?? 'Continue'}</button>
      </div>
    </div>`;
    el.hidden = false;

    dismiss = (confirmed) => { close(); resolve(confirmed); };
    el.addEventListener('click', onBackdropOrButton);
    window.addEventListener('keydown', onKey, true);
    // Enter confirms, except where confirming destroys something: there the safe button has focus.
    el.querySelector<HTMLButtonElement>(cancel && danger ? '[data-modal-cancel]' : '[data-modal-close]')?.focus();
  });
}

function onBackdropOrButton(e: MouseEvent) {
  const el = $('modal');
  const t = e.target as HTMLElement;
  if (t.closest('[data-modal-close]')) dismiss?.(true);
  else if (e.target === el || t.closest('[data-modal-cancel]')) dismiss?.(false);
}

/** Capture phase, and stopped there: while a modal is open, keys belong to it, never to the game underneath. */
function onKey(e: KeyboardEvent) {
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); dismiss?.(false); }
  else if (e.key === 'Enter') {
    // Enter activates whichever button has focus; with nothing focused it confirms.
    const focused = document.activeElement as HTMLElement | null;
    if (focused?.closest('[data-modal-cancel]')) { e.preventDefault(); dismiss?.(false); }
    else { e.preventDefault(); dismiss?.(true); }
  }
}

function close() {
  const el = $('modal');
  el.removeEventListener('click', onBackdropOrButton);
  window.removeEventListener('keydown', onKey, true);
  el.hidden = true;
  el.innerHTML = '';
  dismiss = null;
}
