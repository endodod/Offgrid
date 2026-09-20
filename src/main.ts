import './ui/style.css';
import { DEBUG } from './debug';
import { MISSIONS, type Mission } from './data/missions';
import type { MapDef } from './data/trainingGrounds';
import { draw, TILE } from './render/renderer';
import { Builder } from './ui/builder';
import { initHome, showScreen } from './ui/home';
import { Hud } from './ui/hud';
import { bindInput } from './ui/input';
import { loadCustom } from './ui/mapStore';
import { Session } from './ui/session';

const el = (id: string) => document.getElementById(id)!;

// Debug mode (VITE_DEBUG=true): debug panel + map builder. Otherwise none of it is reachable.
el('debug').hidden = !DEBUG;

/** The map a mission plays: a map saved from the builder (debug mode only), else the default. */
const custom = (m: Mission): MapDef | null => (DEBUG ? loadCustom(m.id, m.map) : null);
const resolve = (m: Mission): MapDef => custom(m) ?? m.map;

const canvas = el('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const session = new Session(resolve(MISSIONS[0]));
const hud = new Hud(session);
bindInput(canvas, session, hud);

let queued = false;
function frame() {
  queued = false;
  const s = session.state;
  if (canvas.width !== s.width * TILE) { canvas.width = s.width * TILE; canvas.height = s.height * TILE; }
  draw(ctx, session.view(performance.now()));
  if (session.floaters.length) request(); // keep animating while floating texts are alive
}
function request() {
  if (!queued) { queued = true; requestAnimationFrame(frame); }
}
session.onChange = () => { hud.update(); request(); };

// ---------- screens ----------
const startGame = (map: MapDef, fromBuilder: boolean) => {
  (el('dbg-fog') as HTMLInputElement).checked = true;
  el('to-builder').hidden = !fromBuilder;
  session.load(map);
  showScreen('game');
  request();
};

let builder: Builder | null = null;
let refreshHome = () => {};
if (DEBUG) {
  builder = new Builder({
    onPlay: (map) => startGame(map, true),
    onExit: () => showScreen('home'),
    onSaved: () => refreshHome(),
  });
  el('to-builder').addEventListener('click', () => { showScreen('builder'); builder!.resume(); });
}

refreshHome = initHome(MISSIONS, {
  resolve,
  isCustom: (m) => custom(m) !== null,
  debug: DEBUG,
  onEnter: (m) => startGame(resolve(m), false),
  onEdit: (m) => { builder!.open(m, resolve(m)); showScreen('builder'); },
});
const toMenu = () => { refreshHome(); showScreen('home'); };
el('menu').addEventListener('click', toMenu);
el('banner-menu').addEventListener('click', toMenu);
showScreen('home');

if (DEBUG) (window as unknown as { session: Session }).session = session; // handy in the devtools console
