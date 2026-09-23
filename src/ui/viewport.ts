import { RES, TILE } from '../render/renderer';
import { seg } from './seg';

/** Tile size, in CSS pixels, for each zoom step. 'fit' scales the whole board into the column instead. */
const ZOOMS: { value: string; label: string; px: number | 'fit'; title: string }[] = [
  { value: 'fit', label: 'Fit', px: 'fit', title: 'Scale the whole board to fit the column' },
  { value: 'sm', label: 'S', px: 22, title: 'Small tiles - more of a large map on screen' },
  { value: 'md', label: 'M', px: 32, title: 'Medium tiles' },
  { value: 'lg', label: 'L', px: 44, title: 'Large tiles' },
];

const KEY = 'offgrid.zoom';
/** A press that moves further than this (CSS px) is a pan, not a click. */
const DRAG_THRESHOLD = 6;
/** Arrow-key pan speed, CSS px per second. */
const PAN_SPEED = 900;
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/**
 * Board zoom, scrolling and camera controls.
 *
 * Story maps are 48x32 - four times the area of the old 24x16 layouts - and scaling one of those into a
 * ~1000px column puts a tile at 20 CSS pixels, which is too small to read a unit's letter or its cover
 * shields. So the board lives in a scroll box with a zoom control, and the camera follows whatever the game
 * is drawing attention to (the selected unit, or the unit the enemy phase is currently moving).
 *
 * The player can also drive the camera (10b): drag with any mouse button to pan (a drag past DRAG_THRESHOLD
 * swallows the click that would otherwise follow it), hold the arrow keys to pan, and Ctrl+wheel / trackpad
 * pinch or the zoom keys to zoom around the cursor. A plain wheel keeps scrolling the box natively, which is
 * what trackpad two-finger panning needs.
 *
 * `ui/input.ts` converts clicks with `canvas.getBoundingClientRect()` against the map's width in tiles, so it
 * already reads whatever scale is applied here - zoom needs no changes there.
 */
export class Viewport {
  private mode: string;
  /** The last tile the camera was pointed at, so a zoom change keeps looking at the same place. */
  private last: { x: number; y: number } | null = null;
  private setSeg: (v: string) => void;
  private drag: { id: number; x: number; y: number; left: number; top: number; panning: boolean } | null = null;
  private suppressClick = false;
  private held = new Set<string>();
  private panFrame = 0;

  /** `active` says whether the board is on screen and keys should reach it (not typing, no modal). */
  constructor(private canvas: HTMLCanvasElement, private wrap: HTMLElement, segEl: HTMLElement, private active: () => boolean) {
    this.mode = load();
    this.setSeg = seg(segEl, ZOOMS.map((z) => ({ value: z.value, label: z.label, title: z.title })), this.mode, (v) => this.setMode(v));

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    // Capture phase, registered before ui/input.ts's own listeners: the click (or, for a right-button drag, the
    // contextmenu = cancel) that ends a pan never reaches them.
    const swallow = (e: Event) => {
      if (!this.suppressClick) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.suppressClick = false;
    };
    canvas.addEventListener('click', swallow, true);
    canvas.addEventListener('contextmenu', swallow, true);
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
    wrap.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return; // plain wheel: native scroll (trackpad panning); Ctrl+wheel and pinch: zoom
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (!(e.key in ARROWS) || !this.active() || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      this.held.add(e.key);
      if (!this.panFrame) this.panLoop(performance.now());
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.key));
    window.addEventListener('blur', () => this.held.clear());
  }

  /** Re-applies the current zoom. Call after the canvas is resized for a new map. */
  apply(anchor?: { clientX: number; clientY: number; lx: number; ly: number }) {
    const z = ZOOMS.find((x) => x.value === this.mode) ?? ZOOMS[0];
    if (z.px === 'fit') {
      this.canvas.style.width = '100%';
      this.canvas.style.maxWidth = '';
    } else {
      const cols = this.canvas.width / (TILE * RES);
      this.canvas.style.width = `${cols * z.px}px`;
      this.canvas.style.maxWidth = 'none';
    }
    // Zooming should not also move you somewhere else. With an anchor (zoom at the cursor) keep that board point
    // under the cursor; otherwise re-centre on whatever the camera was last watching. Next frame, once the
    // browser has laid the new canvas size out.
    if (anchor) {
      requestAnimationFrame(() => {
        const k = this.cssPerLogical();
        const w = this.wrap.getBoundingClientRect();
        this.wrap.scrollTo({ left: anchor.lx * k - (anchor.clientX - w.left), top: anchor.ly * k - (anchor.clientY - w.top) });
      });
      return;
    }
    const last = this.last;
    if (last) requestAnimationFrame(() => this.center(last.x, last.y));
  }

  /** Step the zoom in (+1) or out (-1), keeping the board point under (clientX, clientY) - or the view centre - still. */
  zoomBy(dir: 1 | -1, clientX?: number, clientY?: number) {
    const i = ZOOMS.findIndex((z) => z.value === this.mode);
    const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))];
    if (next.value === this.mode) return;
    const w = this.wrap.getBoundingClientRect();
    const cx = clientX ?? w.left + w.width / 2;
    const cy = clientY ?? w.top + w.height / 2;
    const c = this.canvas.getBoundingClientRect();
    const k = this.cssPerLogical();
    this.setSeg(next.value);
    this.setMode(next.value, { clientX: cx, clientY: cy, lx: (cx - c.left) / k, ly: (cy - c.top) / k });
  }

  private setMode(v: string, anchor?: Parameters<Viewport['apply']>[0]) {
    this.mode = v;
    save(v);
    this.apply(anchor);
  }

  /** CSS pixels per logical (TILE-unit) pixel at the current zoom. */
  private cssPerLogical() {
    return this.canvas.getBoundingClientRect().width / (this.canvas.width / RES);
  }

  /** Put the given tile in the middle of the viewport, for the first frame of a new mission. */
  center(tileX: number, tileY: number, smooth = false) {
    this.last = { x: tileX, y: tileY };
    const scale = this.cssPerLogical();
    this.wrap.scrollTo({
      left: Math.max(0, (tileX + 0.5) * TILE * scale - this.wrap.clientWidth / 2),
      top: Math.max(0, (tileY + 0.5) * TILE * scale - this.wrap.clientHeight / 2),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  /** Scroll the given tile into view, with a margin, but only if it is not comfortably visible already. */
  ensureVisible(tileX: number, tileY: number) {
    if (this.drag?.panning || this.held.size) return; // the player is steering the camera: don't fight them
    this.last = { x: tileX, y: tileY };
    const scale = this.cssPerLogical();
    const px = (tileX + 0.5) * TILE * scale;
    const py = (tileY + 0.5) * TILE * scale;
    const margin = 3 * TILE * scale;
    const { scrollLeft, scrollTop, clientWidth, clientHeight } = this.wrap;
    let left = scrollLeft;
    let top = scrollTop;
    if (px < scrollLeft + margin) left = px - margin;
    else if (px > scrollLeft + clientWidth - margin) left = px - clientWidth + margin;
    if (py < scrollTop + margin) top = py - margin;
    else if (py > scrollTop + clientHeight - margin) top = py - clientHeight + margin;
    if (left !== scrollLeft || top !== scrollTop) {
      this.wrap.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: 'smooth' });
    }
  }

  // ---------- drag to pan ----------
  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || this.drag) return; // touch scrolls the box natively
    if (e.button === 1) e.preventDefault(); // no browser autoscroll on middle-click
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: this.wrap.scrollLeft, top: this.wrap.scrollTop, panning: false };
  };

  private onPointerMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.panning && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.panning) { d.panning = true; this.canvas.classList.add('is-panning'); }
    this.wrap.scrollLeft = d.left - dx;
    this.wrap.scrollTop = d.top - dy;
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (d.panning) {
      this.suppressClick = true;
      setTimeout(() => { this.suppressClick = false; }, 0); // only the click/contextmenu that belongs to this release
    }
    this.canvas.classList.remove('is-panning');
    this.drag = null;
  };

  // ---------- arrow keys ----------
  private panLoop = (then: number) => {
    this.panFrame = requestAnimationFrame((now) => {
      if (!this.held.size || !this.active()) { this.panFrame = 0; this.held.clear(); return; }
      const step = (PAN_SPEED * Math.min(50, now - then)) / 1000;
      let dx = 0, dy = 0;
      for (const k of this.held) { dx += ARROWS[k][0]; dy += ARROWS[k][1]; }
      this.wrap.scrollBy(dx * step, dy * step);
      this.panLoop(now);
    });
  };
}

function load(): string {
  try { return localStorage.getItem(KEY) ?? 'fit'; } catch { return 'fit'; }
}

function save(v: string) {
  try { localStorage.setItem(KEY, v); } catch { /* storage unavailable: zoom just won't persist */ }
}
