/**
 * Pointer-based drag and drop, by delegation.
 *
 * Why not the HTML5 drag-and-drop API: it does not fire for touch at all, its drag image is not stylable on
 * every browser, and it needs per-element listeners that get detached every time a panel re-renders its
 * innerHTML (which this UI does constantly). Pointer events cover mouse, touch and pen with one code path,
 * and one listener on a container survives any number of re-renders underneath it.
 *
 * Three ways to move an item, all going through the same `onDrop`:
 *   - drag: press and move more than a few pixels, drop on a target;
 *   - tap/click: tap the item to arm it, then tap a target (the touch and "I don't like dragging" path);
 *   - keyboard: Enter/Space on the item to arm it, Enter/Space on a target to drop.
 *
 * Markup contract: draggable sources carry `data-drag="<payload>"`, drop targets carry `data-drop="<key>"`.
 * Both are plain strings the caller encodes and decodes however it likes.
 */

export interface DragDropOptions {
  /** Whether `target` will take `payload`. Used both to gate the drop and to highlight eligible targets. */
  accepts: (payload: string, target: string) => boolean;
  onDrop: (payload: string, target: string) => void;
  /** Called whenever the armed (click-to-move) payload changes, so the caller can re-render its highlight. */
  onArmedChange?: (payload: string | null) => void;
}

const DRAG_THRESHOLD = 5; // px of movement before a press becomes a drag rather than a tap

export class DragDrop {
  /** The payload waiting for a target click, or null. */
  armed: string | null = null;

  private ghost: HTMLElement | null = null;
  private payload: string | null = null;
  private source: HTMLElement | null = null;
  private start = { x: 0, y: 0 };
  private dragging = false;
  private overTarget: HTMLElement | null = null;
  private readonly abort = new AbortController();

  constructor(private root: HTMLElement, private opts: DragDropOptions) {
    const signal = this.abort.signal;
    root.addEventListener('pointerdown', this.onPointerDown, { signal });
    root.addEventListener('click', this.onClick, { signal });
    root.addEventListener('keydown', this.onKeyDown, { signal });
    window.addEventListener('pointermove', this.onPointerMove, { signal });
    window.addEventListener('pointerup', this.onPointerUp, { signal });
    window.addEventListener('pointercancel', this.onPointerUp, { signal });
    window.addEventListener('keydown', this.onEscape, { signal });
  }

  /** Drop every listener and any ghost still on screen. */
  destroy() {
    this.abort.abort();
    this.cleanup();
  }

  /** Clear the armed payload (e.g. after the caller re-renders following a successful drop). */
  disarm() {
    if (this.armed === null) return;
    this.armed = null;
    this.opts.onArmedChange?.(null);
  }

  private arm(payload: string | null) {
    this.armed = this.armed === payload ? null : payload;
    this.opts.onArmedChange?.(this.armed);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-drag]');
    if (!el || !this.root.contains(el)) return;
    // Don't hijack a press that started on a button inside the item (e.g. a slot's remove button).
    if ((e.target as HTMLElement).closest('button') && !el.matches('button')) return;
    this.payload = el.dataset.drag!;
    this.source = el;
    this.start = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.payload || !this.source) return;
    if (!this.dragging) {
      if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) < DRAG_THRESHOLD) return;
      this.beginDrag();
    }
    this.moveGhost(e.clientX, e.clientY);
    this.setOverTarget(this.targetUnder(e.clientX, e.clientY));
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.dragging) { this.payload = null; this.source = null; return; }
    const target = this.targetUnder(e.clientX, e.clientY);
    const payload = this.payload!;
    this.cleanup();
    if (target && this.opts.accepts(payload, target.dataset.drop!)) this.opts.onDrop(payload, target.dataset.drop!);
  };

  /** A plain click: either arm a source, or complete an armed move onto a target. */
  private onClick = (e: MouseEvent) => {
    // An explicit action button (a slot's "take off") is the caller's business, not a drag gesture.
    if ((e.target as HTMLElement).closest('button[data-act]')) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-drop]');
    if (this.armed !== null && target) {
      const payload = this.armed;
      this.disarm();
      if (this.opts.accepts(payload, target.dataset.drop!)) this.opts.onDrop(payload, target.dataset.drop!);
      return;
    }
    const source = (e.target as HTMLElement).closest<HTMLElement>('[data-drag]');
    if (source) this.arm(source.dataset.drag!);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-drag], [data-drop]');
    if (!el) return;
    e.preventDefault();
    (el as HTMLElement).click(); // reuse the click path above so there is one set of rules
  };

  private onEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (this.dragging) this.cleanup();
    this.disarm();
  };

  // ---------- drag mechanics ----------

  private beginDrag() {
    this.dragging = true;
    this.disarm();
    const rect = this.source!.getBoundingClientRect();
    const ghost = this.source!.cloneNode(true) as HTMLElement;
    ghost.classList.add('item', 'drag-ghost');
    ghost.style.width = `${rect.width}px`;
    ghost.removeAttribute('data-drag');
    document.body.appendChild(ghost);
    this.ghost = ghost;
    this.source!.classList.add('is-dragging');
    document.body.style.cursor = 'grabbing';
    this.markEligible(true);
  }

  private moveGhost(x: number, y: number) {
    if (!this.ghost) return;
    this.ghost.style.left = `${x - this.ghost.offsetWidth / 2}px`;
    this.ghost.style.top = `${y - this.ghost.offsetHeight / 2}px`;
  }

  /** The drop target under the pointer. The ghost is `pointer-events: none`, so it never shadows one. */
  private targetUnder(x: number, y: number): HTMLElement | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const target = el?.closest<HTMLElement>('[data-drop]') ?? null;
    if (!target || !this.root.contains(target)) return null;
    return this.opts.accepts(this.payload!, target.dataset.drop!) ? target : null;
  }

  private setOverTarget(target: HTMLElement | null) {
    if (this.overTarget === target) return;
    this.overTarget?.classList.remove('is-over');
    target?.classList.add('is-over');
    this.overTarget = target;
  }

  private markEligible(on: boolean) {
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-drop]')) {
      el.classList.toggle('is-eligible', on && this.opts.accepts(this.payload!, el.dataset.drop!));
    }
  }

  private cleanup() {
    this.ghost?.remove();
    this.ghost = null;
    this.source?.classList.remove('is-dragging');
    this.setOverTarget(null);
    if (this.payload !== null) this.markEligible(false);
    this.source = null;
    this.payload = null;
    this.dragging = false;
    document.body.style.cursor = '';
  }
}
