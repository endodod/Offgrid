import './ui/style.css';
import { DEBUG } from './debug';
import { MISSIONS, type Mission } from './data/missions';
import type { MapDef } from './data/trainingGrounds';
import { draw, TILE } from './render/renderer';
import { Base } from './ui/base';
import { Builder } from './ui/builder';
import { Campaign } from './ui/campaign';
import { Equip } from './ui/equip';
import { initHome, showScreen, type Screen } from './ui/home';
import { Hud } from './ui/hud';
import { bindInput } from './ui/input';
import { loadCustom } from './ui/mapStore';
import { initSettings } from './ui/settings';
import { Session } from './ui/session';
import { Tutorial, tutorialDismissed } from './ui/tutorial';

/** The only mission the guided walkthrough covers so far (see ROADMAP.md #0f). */
const TUTORIAL_MISSION_ID = 'training-grounds';

const el = (id: string) => document.getElementById(id)!;

// Debug mode (VITE_DEBUG=true): debug panel, combat log and map builder. Otherwise none of it is reachable.
el('debug').hidden = !DEBUG;
el('log-wrap').hidden = !DEBUG;

/** The map a mission plays: a map saved from the builder (debug mode only), else the default. */
const custom = (m: Mission): MapDef | null => (DEBUG ? loadCustom(m.id, m.map) : null);
const resolve = (m: Mission): MapDef => custom(m) ?? m.map;

const canvas = el('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const session = new Session(resolve(MISSIONS[0]));
const hud = new Hud(session);
bindInput(canvas, session, hud);
const tutorial = new Tutorial(session, () => hud.update());
hud.tutorial = tutorial;

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
// tutorial before hud: a step it advances this change should already be reflected in this same render.
session.onChange = () => { tutorial.onSessionChange(); hud.update(); request(); };

// ---------- screens ----------
// Set when a mission is launched from the campaign screen (5), so a win can be reported back to it, and so
// "Main menu" returns to the campaign screen instead of home.
let activeCampaignMissionId: string | null = null;
let returnScreen: Screen = 'home';

const startGame = (map: MapDef, fromBuilder: boolean, missionId?: string) => {
  (el('dbg-fog') as HTMLInputElement).checked = true;
  el('to-builder').hidden = !fromBuilder;
  session.load(map);
  showScreen('game');
  request();
  const isTutorialMission = missionId === TUTORIAL_MISSION_ID;
  el('tutorial-replay').hidden = !isTutorialMission;
  if (isTutorialMission && !tutorialDismissed()) tutorial.start();
  else tutorial.hide();
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
  onEnter: (m) => { activeCampaignMissionId = null; returnScreen = 'home'; startGame(resolve(m), false, m.id); },
  onEdit: (m) => { builder!.open(m, resolve(m)); showScreen('builder'); },
});
el('tutorial-replay').addEventListener('click', () => tutorial.start());

const campaign = new Campaign({
  onPlay: (map, missionId) => { activeCampaignMissionId = missionId; returnScreen = 'campaign'; startGame(map, false, missionId); },
  onBack: () => showScreen('home'),
});
el('home-campaign').addEventListener('click', () => { campaign.open(); showScreen('campaign'); });

const base = new Base({ onBack: () => { campaign.open(); showScreen('campaign'); } });
el('campaign-to-base').addEventListener('click', () => { base.open(campaign.campaignState()); showScreen('base'); });

const equip = new Equip({ onBack: () => { campaign.open(); showScreen('campaign'); } });
el('campaign-to-equip').addEventListener('click', () => { equip.open(campaign.campaignState()); showScreen('equip'); });

const toMenu = () => {
  if (activeCampaignMissionId && session.state.winner === 'player') campaign.reportWin(activeCampaignMissionId, session.state.units);
  activeCampaignMissionId = null;
  if (returnScreen === 'campaign') { campaign.open(); showScreen('campaign'); }
  else { refreshHome(); showScreen('home'); }
};
el('menu').addEventListener('click', toMenu);
el('banner-menu').addEventListener('click', toMenu);

// Settings can be opened from the home screen or mid-mission; remember which to return to.
let settingsReturnTo: Screen = 'home';
initSettings({ onBack: () => showScreen(settingsReturnTo) });
el('home-settings').addEventListener('click', () => { settingsReturnTo = 'home'; showScreen('settings'); });
el('game-settings').addEventListener('click', () => { settingsReturnTo = 'game'; showScreen('settings'); });

showScreen('home');

if (DEBUG) (window as unknown as { session: Session }).session = session; // handy in the devtools console
