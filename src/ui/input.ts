import type { Hud } from './hud';
import { isGameVisible } from './home';
import {
  BINDABLE_ACTIONS, DEFAULT_BINDINGS, RESERVED_KEY, keyOf, loadBindings, saveBindings,
  type BindableAction, type KeyBindings,
} from './keybindings';
import type { ButtonId, Session } from './session';
import type { Viewport } from './viewport';

let bindings: KeyBindings = loadBindings();

export const getBindings = (): KeyBindings => bindings;
export const keyFor = (a: BindableAction): string => bindings[a];

/** The action already using this key, if any (excluding `except` itself) - for conflict detection while rebinding. */
export function actionUsing(key: string, except?: BindableAction): BindableAction | null {
  return BINDABLE_ACTIONS.find((a) => a !== except && bindings[a] === key) ?? null;
}

/** Rebinds `action` to `key`. Returns null on success, or the reason it was refused. */
export function rebindAction(action: BindableAction, key: string): 'reserved' | BindableAction | null {
  if (key === RESERVED_KEY || key.startsWith('Arrow')) return 'reserved'; // arrows pan the camera (ui/viewport.ts)
  const conflict = actionUsing(key, action);
  if (conflict) return conflict;
  bindings = { ...bindings, [action]: key };
  saveBindings(bindings);
  return null;
}

export function resetBindings() {
  bindings = { ...DEFAULT_BINDINGS };
  saveBindings(bindings);
}

export function bindInput(canvas: HTMLCanvasElement, session: Session, hud: Hud, viewport: Viewport) {
  const tileAt = (ev: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    const scale = session.state.width / r.width; // css px -> tiles
    return { x: Math.floor((ev.clientX - r.left) * scale), y: Math.floor((ev.clientY - r.top) * scale) };
  };
  canvas.addEventListener('mousemove', (ev) => { hud.setMouse(ev.clientX, ev.clientY); session.setHover(tileAt(ev)); });
  canvas.addEventListener('mouseleave', () => session.setHover(null));
  canvas.addEventListener('click', (ev) => session.click(tileAt(ev)));
  canvas.addEventListener('contextmenu', (ev) => { ev.preventDefault(); session.cancel(); });
  canvas.addEventListener('wheel', (ev) => {
    if (session.mode !== 'gadget') return; // only hijack the wheel while placing cover
    ev.preventDefault();
    session.rotateCover(ev.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  window.addEventListener('keydown', (ev) => {
    if (!isGameVisible() || ev.ctrlKey || ev.metaKey || ev.altKey || (ev.target as HTMLElement).tagName === 'INPUT') return;
    if (ev.key.startsWith('Arrow')) return; // arrows pan the camera (ui/viewport.ts) and are never bound
    if (ev.key === RESERVED_KEY) return session.cancel(); // always cancel, never rebindable
    const key = keyOf(ev) === '+' ? '=' : keyOf(ev); // Shift+= is still "zoom in" on most layouts
    const action = BINDABLE_ACTIONS.find((a) => bindings[a] === key);
    if (!action) return;
    ev.preventDefault();
    if (action === 'zoomIn' || action === 'zoomOut') return viewport.zoomBy(action === 'zoomIn' ? 1 : -1);
    if (action === 'centerCamera') {
      const u = session.selected() ?? session.state.units.find((x) => x.team === 'player' && x.alive);
      if (u) viewport.center(u.x, u.y, true);
      return;
    }
    if (action === 'toggleOverwatchView') return session.toggleOverwatchView();
    if (action === 'toggleAutoRun') return session.toggleAutoRun();
    if (action === 'rotateCoverCW') return session.rotateCover(ev.shiftKey ? -1 : 1);
    if (action.startsWith('selectUnit')) {
      const mine = session.state.units.filter((u) => u.team === 'player');
      const u = mine[Number(action.slice('selectUnit'.length)) - 1];
      if (u) session.toggleSelect(u.id);
      return;
    }
    session.press(action as ButtonId);
  });
}
