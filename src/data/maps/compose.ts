/**
 * A tiny authoring toolkit for the story maps.
 *
 * Story maps are 48x32 - 1536 tiles each. Typing thirty-two 48-character strings by hand is not level design,
 * it is transcription, and every edit shifts something three rows away by one column without saying so. So a
 * mission file describes its layout structurally (`building(g, 3, 2, 11, 8, [[8, 9]])` - a building with a
 * door) and hand-draws only the details that deserve it, via `stamp`.
 *
 * The output is still a plain `string[]` of rows: nothing downstream knows these maps were composed rather
 * than typed, and the map builder can still open, edit and export them.
 *
 * Tile characters are the same set `core/mapFormat.ts` validates:
 *   '.' floor   '#' wall   'b' bush   'h' high cover   'l' '1' '2' '3' low cover (rotations)   'O' objective
 */

export type Grid = string[][];

export const STORY_W = 48;
export const STORY_H = 32;

/** A w x h grid of `ch`. */
export function field(w = STORY_W, h = STORY_H, ch = '.'): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ch));
}

export const toRows = (g: Grid): string[] => g.map((row) => row.join(''));

const inside = (g: Grid, x: number, y: number) => y >= 0 && y < g.length && x >= 0 && x < g[0].length;

export function put(g: Grid, x: number, y: number, ch: string): void {
  if (inside(g, x, y)) g[y][x] = ch;
}

/** Filled rectangle. */
export function rect(g: Grid, x: number, y: number, w: number, h: number, ch: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, ch);
}

/** Rectangle border only, interior untouched. */
export function outline(g: Grid, x: number, y: number, w: number, h: number, ch: string): void {
  for (let i = x; i < x + w; i++) { put(g, i, y, ch); put(g, i, y + h - 1, ch); }
  for (let j = y; j < y + h; j++) { put(g, x, j, ch); put(g, x + w - 1, j, ch); }
}

/**
 * A building: wall outline, clear floor inside, with a hole punched at each of `doors`. The door coordinates
 * are absolute and must lie on the outline - that is deliberate, so a mission file reads "there is a way in at
 * (8,9)" rather than "there is a way in somewhere along the south wall".
 */
export function building(g: Grid, x: number, y: number, w: number, h: number, doors: [number, number][] = []): void {
  rect(g, x, y, w, h, '.');
  outline(g, x, y, w, h, '#');
  for (const [dx, dy] of doors) put(g, dx, dy, '.');
}

export function hRun(g: Grid, x: number, y: number, len: number, ch: string): void {
  for (let i = 0; i < len; i++) put(g, x + i, y, ch);
}

export function vRun(g: Grid, x: number, y: number, len: number, ch: string): void {
  for (let j = 0; j < len; j++) put(g, x, y + j, ch);
}

/** Scatter one character over a list of absolute positions - cover clumps, bushes, rubble. */
export function pts(g: Grid, list: [number, number][], ch: string): void {
  for (const [x, y] of list) put(g, x, y, ch);
}

/**
 * Hand-draw a patch. Every character in `pattern` is written except a space, which leaves whatever is
 * underneath - so a stamp can add a cover arrangement to an existing floor without redrawing it.
 */
export function stamp(g: Grid, x: number, y: number, pattern: string[]): void {
  pattern.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ' ') put(g, x + i, y + j, ch); }));
}

/** Pairs of low cover along a row, at each x in `xs` - the "parked cars / market stalls" idiom. */
export function coverPairs(g: Grid, y: number, xs: number[], ch = 'l'): void {
  for (const x of xs) { put(g, x, y, ch); put(g, x + 1, y, ch); }
}
