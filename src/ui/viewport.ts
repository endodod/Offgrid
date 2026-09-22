import { TILE } from '../render/renderer';
import { seg } from './seg';

/** Tile size, in CSS pixels, for each zoom step. 'fit' scales the whole board into the column instead. */
const ZOOMS: { value: string; label: string; px: number | 'fit'; title: string }[] = [
  { value: 'fit', label: 'Fit', px: 'fit', title: 'Scale the whole board to fit the column' },
  { value: 'sm', label: 'S', px: 22, title: 'Small tiles - more of a large map on screen' },
  { value: 'md', label: 'M', px: 32, title: 'Medium tiles' },
  { value: 'lg', label: 'L', px: 44, title: 'Large tiles' },
];

const KEY = 'offgrid.zoom';

/**
 * Board zoom and scrolling.
 *
 * Story maps are 48x32 - four times the area of the old 24x16 layouts - and scaling one of those into a
 * ~1000px column puts a tile at 20 CSS pixels, which is too small to read a unit's letter or its cover
 * shields. So the board lives in a scroll box with a zoom control, and the camera follows whatever the game
 * is drawing attention to (the selected unit, or the unit the enemy phase is currently moving).
 *
 * `ui/input.ts` converts clicks with `canvas.getBoundingClientRect()` against `canvas.width`, so it already
 * reads whatever scale is applied here - zoom needs no changes there.
 */
export class Viewport {
  private mode: string;

  constructor(private canvas: HTMLCanvasElement, private wrap: HTMLElement, segEl: HTMLElement) {
    this.mode = load();
    seg(segEl, ZOOMS.map((z) => ({ value: z.value, label: z.label, title: z.title })), this.mode, (v) => {
      this.mode = v;
      save(v);
      this.apply();
    });
  }

  /** Re-applies the current zoom. Call after the canvas is resized for a new map. */
  apply() {
    const z = ZOOMS.find((x) => x.value === this.mode) ?? ZOOMS[0];
    if (z.px === 'fit') {
      this.canvas.style.width = '100%';
      this.canvas.style.maxWidth = '';
    } else {
      const cols = this.canvas.width / TILE;
      this.canvas.style.width = `${cols * z.px}px`;
      this.canvas.style.maxWidth = 'none';
    }
  }

  /** Scroll the given tile into view, with a margin, but only if it is not comfortably visible already. */
  ensureVisible(tileX: number, tileY: number) {
    const scale = this.canvas.getBoundingClientRect().width / this.canvas.width; // device px -> css px
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
}

function load(): string {
  try { return localStorage.getItem(KEY) ?? 'fit'; } catch { return 'fit'; }
}

function save(v: string) {
  try { localStorage.setItem(KEY, v); } catch { /* storage unavailable: zoom just won't persist */ }
}
