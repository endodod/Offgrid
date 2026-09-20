import { TILE } from '../render/renderer';
import type { Hud } from './hud';
import { isGameVisible } from './home';
import type { ButtonId, Session } from './session';

const KEYS: Record<string, ButtonId> = {
  m: 'move', a: 'attack', r: 'reload', g: 'gadget', o: 'overwatch', f: 'aid', i: 'interact', e: 'endTurn', Enter: 'endTurn',
};

export function bindInput(canvas: HTMLCanvasElement, session: Session, hud: Hud) {
  const tileAt = (ev: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    const scale = canvas.width / TILE / r.width; // css px -> tiles
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
    if (ev.key === 'Escape') return session.cancel();
    if (ev.key.toLowerCase() === 'v') return session.toggleOverwatchView();
    if (ev.key.toLowerCase() === 'q') return session.rotateCover(ev.shiftKey ? -1 : 1);
    if (ev.key >= '1' && ev.key <= '5') {
      const mine = session.state.units.filter((u) => u.team === 'player');
      const u = mine[Number(ev.key) - 1];
      if (u) session.toggleSelect(u.id);
      return;
    }
    const b = KEYS[ev.key] ?? KEYS[ev.key.toLowerCase()];
    if (b) { ev.preventDefault(); session.press(b); }
  });
}
