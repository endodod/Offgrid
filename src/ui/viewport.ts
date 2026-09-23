import { RES, TILE } from '../render/renderer';
import { seg } from './seg';
import { keyOf, PAN_ACTIONS } from './keybindings';
import { getBindings } from './input';

/** Zoom presets for the buttons, as tile size in CSS pixels. 'fit' scales the whole board into the box. The
 *  wheel and the zoom keys move freely between and beyond them (14); a preset button just jumps there. */
const PRESETS: { value: string; label: string; px: number | 'fit'; title: string }[] = [
  { value: 'fit', label: 'Fit', px: 'fit', title: 'Scale the whole board to fit the view' },
  { value: 'sm', label: 'S', px: 22, title: 'Small tiles - more of a large map on screen' },
  { value: 'md', label: 'M', px: 32, title: 'Medium tiles' },
  { value: 'lg', label: 'L', px: 44, title: 'Large tiles' },
];
const MAX_PX = 72;
/** How far past "whole board fits" the player may zoom out, to see the outskirts around it. */
const MIN_FIT_SHARE = 0.75;
/** Each wheel notch (deltaY 100) or zoom key press scales by this. */
const ZOOM_STEP = 1.15;

const KEY = 'offgrid.zoom';
/** A press that moves further than this (CSS px) is a pan, not a click. */
const DRAG_THRESHOLD = 6;
/** Map-move key pan speed, CSS px per second. */
const PAN_SPEED = 900;
/** How much of the view may be past the board's edge when panned all the way over (the outskirts, 14). */
const EDGE_SHARE = 0.35;

/** The pan direction a key is bound to right now (defaults: the arrow keys), or null. */
function panDir(key: string): [number, number] | null {
  const b = getBindings();
  for (const [action, dir] of Object.entries(PAN_ACTIONS)) if (b[action as keyof typeof PAN_ACTIONS] === key) return dir;
  return null;
}

/**
 * Board zoom and camera.
 *
 * Story maps are 48x32, so the board lives in a fixed-size box with a zoom, and the camera follows whatever
 * the game is drawing attention to (the selected unit, or the unit the enemy phase is moving).
 *
 * The player drives the camera (10b, reworked in 14) only three ways: hold the map-move keys (the arrows by
 * default); hold the left button (or a finger) and drag - a press that moves less than DRAG_THRESHOLD is still
 * a click; and zoom smoothly with the wheel, a pinch, the zoom keys or a preset button, around the cursor. The
 * box never scrolls by itself (no scrollbars, no wheel scrolling).
 *
 * The board sits inside a margin (`pad`) so it can be panned partway past its edges, and centred when it's
 * smaller than the box. That margin shows the city's outskirts under fog (style.css `.canvas-wrap`), never
 * blank space.
 *
 * `ui/input.ts` converts clicks with `canvas.getBoundingClientRect()` against the map's width in tiles, so it
 * reads whatever scale and offset are applied here.
 */
export class Viewport {
  /** Tile size in CSS px, or 'fit' (recomputed from the box whenever the board or the box changes). */
  private zoom: number | 'fit';
  /** The board's offset inside the scroll area, in CSS px. */
  private pad = { x: 0, y: 0 };
  private last: { x: number; y: number } | null = null;
  private setSeg: (v: string) => void;
  private drag: { id: number; x: number; y: number; left: number; top: number; panning: boolean } | null = null;
  private suppressClick = false;
  private held = new Set<string>();
  private panFrame = 0;

  /** `active` says whether the board is on screen and keys should reach it (not typing, no modal). */
  constructor(private canvas: HTMLCanvasElement, private wrap: HTMLElement, segEl: HTMLElement, private active: () => boolean) {
    this.zoom = load();
    this.setSeg = seg(segEl, PRESETS.map((z) => ({ value: z.value, label: z.label, title: z.title })), this.presetValue(), (v) => {
      const p = PRESETS.find((z) => z.value === v)!;
      this.setZoom(p.px);
    });

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    // Capture phase, registered before ui/input.ts's own listeners: the click that ends a pan never reaches them.
    const swallow = (e: Event) => {
      if (!this.suppressClick) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.suppressClick = false;
    };
    canvas.addEventListener('click', swallow, true);
    canvas.addEventListener('contextmenu', swallow, true);
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // no middle-click autoscroll
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) this.onPointerDown(e); }); // drag from the outskirts too
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault(); // the board never scrolls
      if ((e as WheelEvent & { rotatesCover?: boolean }).rotatesCover) return; // ui/input.ts: turning cover while placing it
      // Smooth: the zoom follows the wheel's own delta, so a trackpad glides and a mouse notch is one step.
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      this.zoomAt(Math.pow(ZOOM_STEP, -delta / 100), e.clientX, e.clientY);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (!panDir(keyOf(e)) || !this.active() || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      e.preventDefault();
      this.held.add(keyOf(e));
      if (!this.panFrame) this.panLoop(performance.now());
    });
    window.addEventListener('keyup', (e) => this.held.delete(keyOf(e)));
    window.addEventListener('blur', () => this.held.clear());
    window.addEventListener('resize', () => this.apply());
  }

  // ---------- zoom ----------
  private cols() { return this.canvas.width / (TILE * RES); }
  private rows() { return this.canvas.height / (TILE * RES); }
  /** Tile size that fits the whole board in the box. */
  private fitPx() {
    return Math.max(4, Math.min(this.wrap.clientWidth / this.cols(), this.wrap.clientHeight / this.rows()));
  }
  private tilePx() {
    const fit = this.fitPx();
    return this.zoom === 'fit' ? fit : Math.min(MAX_PX, Math.max(fit * MIN_FIT_SHARE, this.zoom));
  }
  /** The preset the current zoom is on, if any - the buttons light up only then. */
  private presetValue(): string {
    if (this.zoom === 'fit') return 'fit';
    const z = this.zoom;
    return PRESETS.find((p) => p.px !== 'fit' && Math.abs(p.px - z) < 0.5)?.value ?? '';
  }

  /** Re-applies the zoom and the outskirts margin. Call after the canvas is resized for a new map. */
  apply(anchor?: { clientX: number; clientY: number; lx: number; ly: number }) {
    if (!this.wrap.clientWidth) return; // not on screen yet
    const px = this.tilePx();
    const w = this.cols() * px, h = this.rows() * px;
    const vw = this.wrap.clientWidth, vh = this.wrap.clientHeight;
    // Enough margin to pan EDGE_SHARE of the view past each edge, and to centre a board smaller than the box.
    this.pad = { x: Math.round(Math.max(vw * EDGE_SHARE, (vw - w) / 2)), y: Math.round(Math.max(vh * EDGE_SHARE, (vh - h) / 2)) };
    this.canvas.style.width = `${w}px`;
    this.canvas.style.maxWidth = 'none';
    this.canvas.style.margin = `${this.pad.y}px ${this.pad.x}px`;
    this.setSeg(this.presetValue());
    if (anchor) {
      // Keep the board point that was under the cursor under it.
      const k = px / TILE;
      const r = this.wrap.getBoundingClientRect();
      this.scrollTo(this.pad.x + anchor.lx * k - (anchor.clientX - r.left), this.pad.y + anchor.ly * k - (anchor.clientY - r.top));
      return;
    }
    const last = this.last;
    if (last) this.center(last.x, last.y);
  }

  /** Zoom in (+1) or out (-1) one step around the view centre - the zoom keys. */
  zoomBy(dir: 1 | -1, clientX?: number, clientY?: number) {
    this.zoomAt(dir > 0 ? ZOOM_STEP : 1 / ZOOM_STEP, clientX, clientY);
  }

  /** Scale the zoom by `factor`, keeping the board point under (clientX, clientY) - or the view centre - still. */
  private zoomAt(factor: number, clientX?: number, clientY?: number) {
    const before = this.tilePx();
    const next = Math.min(MAX_PX, Math.max(this.fitPx() * MIN_FIT_SHARE, before * factor));
    if (Math.abs(next - before) < 0.01) return;
    const r = this.wrap.getBoundingClientRect();
    const cx = clientX ?? r.left + r.width / 2;
    const cy = clientY ?? r.top + r.height / 2;
    const c = this.canvas.getBoundingClientRect();
    const k = this.cssPerLogical();
    this.setZoom(next, { clientX: cx, clientY: cy, lx: (cx - c.left) / k, ly: (cy - c.top) / k });
  }

  private setZoom(z: number | 'fit', anchor?: Parameters<Viewport['apply']>[0]) {
    this.zoom = z;
    save(z);
    this.apply(anchor);
  }

  /** CSS pixels per logical (TILE-unit) pixel at the current zoom. */
  private cssPerLogical() {
    return this.canvas.getBoundingClientRect().width / (this.canvas.width / RES);
  }

  /** Scrolls the box - except along an axis where the whole board already fits, which stays centred: the
   *  camera following a unit never slides a fitted board off to one side. */
  private scrollTo(left: number, top: number, smooth = false) {
    const k = this.cssPerLogical();
    const w = this.cols() * TILE * k, h = this.rows() * TILE * k;
    const vw = this.wrap.clientWidth, vh = this.wrap.clientHeight;
    if (w <= vw) left = this.pad.x + w / 2 - vw / 2;
    if (h <= vh) top = this.pad.y + h / 2 - vh / 2;
    this.wrap.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  }

  // ---------- camera ----------
  /** Put the given tile in the middle of the view. */
  center(tileX: number, tileY: number, smooth = false) {
    this.last = { x: tileX, y: tileY };
    const k = this.cssPerLogical();
    this.scrollTo(this.pad.x + (tileX + 0.5) * TILE * k - this.wrap.clientWidth / 2, this.pad.y + (tileY + 0.5) * TILE * k - this.wrap.clientHeight / 2, smooth);
  }

  /** Bring the given tile into view, with a margin, but only if it is not comfortably visible already. */
  ensureVisible(tileX: number, tileY: number) {
    if (this.drag?.panning || this.held.size) return; // the player is steering the camera: don't fight them
    this.last = { x: tileX, y: tileY };
    const k = this.cssPerLogical();
    const px = this.pad.x + (tileX + 0.5) * TILE * k;
    const py = this.pad.y + (tileY + 0.5) * TILE * k;
    const margin = 3 * TILE * k;
    const { scrollLeft, scrollTop, clientWidth, clientHeight } = this.wrap;
    let left = scrollLeft;
    let top = scrollTop;
    if (px < scrollLeft + margin) left = px - margin;
    else if (px > scrollLeft + clientWidth - margin) left = px - clientWidth + margin;
    if (py < scrollTop + margin) top = py - margin;
    else if (py > scrollTop + clientHeight - margin) top = py - clientHeight + margin;
    if (left !== scrollLeft || top !== scrollTop) this.scrollTo(left, top, true);
  }

  // ---------- drag to pan ----------
  private onPointerDown = (e: PointerEvent) => {
    if (this.drag || e.button !== 0) return; // left button, or a finger; right-click stays "cancel"
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: this.wrap.scrollLeft, top: this.wrap.scrollTop, panning: false };
  };

  private onPointerMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.panning && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.panning) { d.panning = true; this.wrap.classList.add('is-panning'); }
    this.wrap.scrollLeft = d.left - dx;
    this.wrap.scrollTop = d.top - dy;
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (d.panning) {
      this.suppressClick = true;
      setTimeout(() => { this.suppressClick = false; }, 0); // only the click that belongs to this release
    }
    this.wrap.classList.remove('is-panning');
    this.drag = null;
  };

  // ---------- map-move keys ----------
  private panLoop = (then: number) => {
    this.panFrame = requestAnimationFrame((now) => {
      if (!this.held.size || !this.active()) { this.panFrame = 0; this.held.clear(); return; }
      const step = (PAN_SPEED * Math.min(50, now - then)) / 1000;
      let dx = 0, dy = 0;
      for (const k of this.held) { const d = panDir(k); if (d) { dx += d[0]; dy += d[1]; } }
      this.wrap.scrollBy(dx * step, dy * step);
      this.panLoop(now);
    });
  };
}

/** The saved zoom: a tile size, or 'fit'. Older saves stored a preset id ('sm', 'md', 'lg'). */
function load(): number | 'fit' {
  try {
    const v = localStorage.getItem(KEY);
    const preset = PRESETS.find((p) => p.value === v);
    if (preset) return preset.px;
    const n = Number(v);
    return v && Number.isFinite(n) && n > 0 ? n : 'fit';
  } catch { return 'fit'; }
}

function save(v: number | 'fit') {
  try { localStorage.setItem(KEY, String(typeof v === 'number' ? Math.round(v * 10) / 10 : v)); } catch { /* won't persist */ }
}
