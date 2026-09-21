import type { InteractableDef, MapDef, PickupDef, Spawn } from '../data/trainingGrounds';
import { CLASSES, type ClassId } from '../data/units';
import { AI_PROFILES, type AiProfileId } from '../data/aiProfiles';
import { ITEM_ORDER } from '../data/items';
import { ARMOR_ORDER } from '../data/armor';
import { EQUIPMENT_ORDER } from '../data/equipment';

/** Tile characters a map may contain (see MapDef.rows). */
export const TILE_CHARS = '.#bl123hO';
/** Tiles a unit may stand on. A door/switch (2) sits on one of these too - the grid stays plain floor under it. */
export const WALKABLE = '.b';

type Spawns = MapDef['spawns'];

/** Builds a map from edited rows/spawns(/interactables/pickups). Search waypoints inside an obstacle are dropped. */
export function withEdits(
  base: MapDef, rows: string[], spawns: Spawns,
  interactables: InteractableDef[] = base.interactables ?? [], pickups: PickupDef[] = base.pickups ?? [],
): MapDef {
  const open = ([x, y]: [number, number]) => WALKABLE.includes(rows[y]?.[x] ?? '#');
  return {
    ...base,
    rows,
    spawns,
    interactables,
    pickups,
    searchPoints: { player: base.searchPoints.player.filter(open), enemy: base.searchPoints.enemy.filter(open) },
  };
}

/** Validates untrusted map data (an import or a saved map). Throws an Error with a readable message. */
export function parseMap(raw: unknown, base: MapDef): MapDef {
  if (typeof raw !== 'object' || raw === null) throw new Error('Expected a JSON object with "rows" and "spawns".');
  const { rows, spawns } = raw as { rows?: unknown; spawns?: Record<string, unknown> };
  const h = base.rows.length, w = base.rows[0].length;
  if (!Array.isArray(rows) || rows.length !== h) throw new Error(`"rows" must be a list of ${h} strings.`);
  let objectives = 0;
  rows.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== w) throw new Error(`Row ${y} must be a string of ${w} characters.`);
    [...row].forEach((ch, x) => {
      if (!TILE_CHARS.includes(ch)) throw new Error(`Unknown tile "${ch}" at (${x},${y}).`);
      if (ch === 'O') objectives++;
    });
  });
  // A 'reach' objective (3) marks a multi-tile extraction zone with 'O'; every other type (including the
  // legacy hold-a-terminal default) still means at most one.
  if (base.objective?.type === 'reach') { if (objectives < 1) throw new Error('A reach objective needs at least one objective tile.'); }
  else if (objectives > 1) throw new Error('At most one objective tile is allowed.');

  const taken = new Set<string>();
  const parseTeam = (team: 'player' | 'enemy'): Spawn[] => {
    const list = spawns?.[team];
    if (!Array.isArray(list) || list.length === 0) throw new Error(`Need at least one ${team} unit.`);
    return list.map((s) => {
      const [cls, x, y, profile] = s as [unknown, unknown, unknown, unknown];
      if (typeof cls !== 'string' || !(cls in CLASSES)) throw new Error(`Unknown unit class "${String(cls)}".`);
      if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`Bad spawn position for ${cls}.`);
      if (profile !== undefined && (typeof profile !== 'string' || !(profile in AI_PROFILES))) throw new Error(`Unknown AI profile "${String(profile)}".`);
      const [px, py] = [x as number, y as number];
      if (!WALKABLE.includes((rows[py] as string | undefined)?.[px] ?? '#')) throw new Error(`${team} ${cls} at (${px},${py}) is not on an open tile.`);
      if (taken.has(`${px},${py}`)) throw new Error(`Two units share tile (${px},${py}).`);
      taken.add(`${px},${py}`);
      return profile !== undefined ? [cls as ClassId, px, py, profile as AiProfileId] : [cls as ClassId, px, py];
    });
  };
  const spawnsOut = { player: parseTeam('player'), enemy: parseTeam('enemy') };

  const rawInteractables = (raw as { interactables?: unknown }).interactables;
  const interactables: InteractableDef[] = [];
  if (rawInteractables !== undefined) {
    if (!Array.isArray(rawInteractables)) throw new Error('"interactables" must be a list.');
    const ids = new Set<number>();
    for (const rawIt of rawInteractables) {
      const { id, type, x, y, active, links } = rawIt as Partial<InteractableDef>;
      if (typeof id !== 'number' || !Number.isInteger(id)) throw new Error(`Bad interactable id "${String(id)}".`);
      if (ids.has(id)) throw new Error(`Two interactables share id ${id}.`);
      ids.add(id);
      if (type !== 'door' && type !== 'switch' && type !== 'chest') throw new Error(`Unknown interactable type "${String(type)}" (id ${id}).`);
      if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`Bad position for interactable ${id}.`);
      if (!WALKABLE.includes((rows[y as number] as string | undefined)?.[x as number] ?? '#')) throw new Error(`Interactable ${id} at (${x},${y}) is not on an open tile.`);
      if (taken.has(`${x},${y}`)) throw new Error(`Interactable ${id} at (${x},${y}) shares a tile with a unit.`);
      if (active !== undefined && typeof active !== 'boolean') throw new Error(`Bad "active" for interactable ${id}.`);
      if (links !== undefined && (!Array.isArray(links) || links.some((l) => !Number.isInteger(l)))) throw new Error(`Bad "links" for interactable ${id}.`);
      interactables.push({ id, type, x: x as number, y: y as number, ...(active !== undefined && { active }), ...(links !== undefined && { links }) });
    }
    const doorIds = new Set(interactables.filter((it) => it.type === 'door').map((it) => it.id));
    for (const it of interactables) {
      if (it.type !== 'switch') continue;
      for (const l of it.links ?? []) if (!doorIds.has(l)) throw new Error(`Switch ${it.id} links to non-door id ${l}.`);
    }
    const spots = new Map<string, number>();
    for (const it of interactables) {
      const key = `${it.x},${it.y}`;
      if (spots.has(key)) throw new Error(`Interactables ${spots.get(key)} and ${it.id} share tile (${it.x},${it.y}).`);
      spots.set(key, it.id);
      taken.add(key); // so a pickup (4) below can't stack onto a door/switch either
    }
  }

  const rawPickups = (raw as { pickups?: unknown }).pickups;
  const pickups: PickupDef[] = [];
  if (rawPickups !== undefined) {
    if (!Array.isArray(rawPickups)) throw new Error('"pickups" must be a list.');
    const ids = new Set<number>();
    for (const rawP of rawPickups) {
      const { id, type, x, y, amount, itemId } = rawP as Partial<PickupDef>;
      if (typeof id !== 'number' || !Number.isInteger(id)) throw new Error(`Bad pickup id "${String(id)}".`);
      if (ids.has(id)) throw new Error(`Two pickups share id ${id}.`);
      ids.add(id);
      if (!type || !(ITEM_ORDER as string[]).includes(type)) throw new Error(`Unknown pickup type "${String(type)}" (id ${id}).`);
      if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`Bad position for pickup ${id}.`);
      if (!WALKABLE.includes((rows[y as number] as string | undefined)?.[x as number] ?? '#')) throw new Error(`Pickup ${id} at (${x},${y}) is not on an open tile.`);
      const key = `${x},${y}`;
      if (taken.has(key)) throw new Error(`Pickup ${id} at (${x},${y}) shares a tile with something already there.`);
      taken.add(key);
      if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0)) throw new Error(`Bad "amount" for pickup ${id}.`);
      if (type === 'armor' && !(ARMOR_ORDER as string[]).includes(itemId as string)) throw new Error(`Pickup ${id} needs a valid armor "itemId".`);
      if (type === 'equipment' && !(EQUIPMENT_ORDER as string[]).includes(itemId as string)) throw new Error(`Pickup ${id} needs a valid equipment "itemId".`);
      pickups.push({ id, type, x: x as number, y: y as number, ...(amount !== undefined && { amount }), ...(itemId !== undefined && { itemId }) });
    }
  }

  return withEdits(base, rows as string[], spawnsOut, interactables, pickups);
}

/** JSON text for export/import and storage: one row per line so it stays readable and diff-able. */
export function serializeMap(map: MapDef): string {
  const rows = map.rows.map((r) => `  ${JSON.stringify(r)}`).join(',\n');
  const team = (t: 'player' | 'enemy') => map.spawns[t].map((s) => JSON.stringify(s)).join(', ');
  const interactables = map.interactables?.length ? `,\n "interactables": [\n${map.interactables.map((it) => `  ${JSON.stringify(it)}`).join(',\n')}\n ]` : '';
  const pickups = map.pickups?.length ? `,\n "pickups": [\n${map.pickups.map((p) => `  ${JSON.stringify(p)}`).join(',\n')}\n ]` : '';
  return `{\n "rows": [\n${rows}\n ],\n "spawns": {\n  "player": [${team('player')}],\n  "enemy": [${team('enemy')}]\n }${interactables}${pickups}\n}`;
}
