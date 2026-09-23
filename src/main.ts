import './ui/style.css';
import { DEBUG } from './debug';
import { MISSIONS, type Mission } from './data/missions';
import type { MapDef } from './data/trainingGrounds';
import type { GameState } from './core/types';
import { draw, hasAmbientMotion, RES, TILE } from './render/renderer';
import { Base } from './ui/base';
import { unlockAudio } from './ui/audio';
import { Briefing } from './ui/briefing';
import { Builder } from './ui/builder';
import { Campaign, confirmRetreat } from './ui/campaign';
import { Equip } from './ui/equip';
import { initHome, isGameVisible, renderCampaignTile, showScreen, type Screen } from './ui/home';
import { Lore } from './ui/lore';
import { Hud } from './ui/hud';
import { icon, type IconName } from './ui/icons';
import { bindInput } from './ui/input';
import { loadCustom } from './ui/mapStore';
import { clearMission, loadMission, saveMission, type SaveSlot } from './ui/missionStore';
import { Stash } from './ui/stash';
import { confirmModal } from './ui/modal';
import { getPrefs } from './ui/prefs';
import { applyPalette, initSettings } from './ui/settings';
import { Session } from './ui/session';
import { Tutorial, tutorialDismissed } from './ui/tutorial';
import { Viewport } from './ui/viewport';

/** The only mission the guided walkthrough covers so far (see ROADMAP.md #0f). */
const TUTORIAL_MISSION_ID = 'training-grounds';

const el = (id: string) => document.getElementById(id)!;
applyPalette();

// Browsers only start audio after a gesture (10e): the first press anywhere creates the audio context.
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlockAudio, { capture: true });

// Static markup asks for its icon with data-icon rather than inlining SVG; fill them in once at boot.
for (const node of document.querySelectorAll<HTMLElement>('[data-icon]')) {
  node.insertAdjacentHTML('afterbegin', icon(node.dataset.icon as IconName));
}

// Debug mode (VITE_DEBUG=true): debug panel and map builder. Otherwise neither is reachable. The combat log is
// for everyone - it is fog-filtered (ui/log.ts), so it never tells the player more than the board does.
el('debug').hidden = !DEBUG;

/** The map a mission plays: a map saved from the builder (debug mode only), else the default. */
const custom = (m: Mission): MapDef | null => (DEBUG ? loadCustom(m.id, m.map) : null);
const resolve = (m: Mission): MapDef => custom(m) ?? m.map;

const canvas = el('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const session = new Session(resolve(MISSIONS[0]));
const hud = new Hud(session);
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '');
const viewport = new Viewport(canvas, el('board-wrap'), el('zoom'), () => isGameVisible() && el('modal').hidden && !typing());
bindInput(canvas, session, hud, viewport);
const tutorial = new Tutorial(session, () => hud.update());
hud.tutorial = tutorial;

let queued = false;
let wasAnimating = false;
function frame() {
  queued = false;
  const s = session.state;
  if (canvas.width !== Math.round(s.width * TILE * RES) || canvas.height !== Math.round(s.height * TILE * RES)) {
    canvas.width = Math.round(s.width * TILE * RES);
    canvas.height = Math.round(s.height * TILE * RES);
    viewport.apply();
  }
  const now = performance.now();
  draw(ctx, session.view(now));
  // Keep animating while anything is still playing back (10d) or floating texts are alive; once playback ends,
  // one last change lets the HUD and hover highlights (suppressed while it plays) catch up.
  if (session.animating(now)) { wasAnimating = true; hud.updateLog(now); request(); }
  else if (wasAnimating) { wasAnimating = false; session.onChange(); }
  else if (session.floaters.length) request();
  else if (getPrefs().weatherFx && hasAmbientMotion(s) && isGameVisible() && !ambientTimer) {
    ambientTimer = window.setTimeout(() => { ambientTimer = 0; request(); }, 33); // weather (10i) doesn't need 60 fps
  }
}
let ambientTimer = 0;
function request() {
  if (!queued) { queued = true; requestAnimationFrame(frame); }
}
// tutorial before hud: a step it advances this change should already be reflected in this same render.
session.onChange = () => {
  tutorial.onSessionChange();
  hud.update();
  request();
  // Keep the camera on whatever the game is drawing attention to: the selected unit during the player's
  // phase, or the unit that just acted during the enemy's. Only matters on maps bigger than the viewport.
  // Only when that changes: onChange also fires on every hover, and re-asserting an unchanged focus then
  // would yank the camera back each time the mouse moved after the player panned away.
  const focus = session.focusTile();
  if (focus && (focus.x !== lastFocus?.x || focus.y !== lastFocus?.y)) viewport.ensureVisible(focus.x, focus.y);
  lastFocus = focus && { ...focus };
};
let lastFocus: { x: number; y: number } | null = null;

// ---------- screens ----------
// Set when a mission is launched from the campaign screen (5), so a win can be reported back to it, and so
// "Main menu" returns to the campaign screen instead of home.
let activeCampaignMissionId: string | null = null;
let activeMissionId: string | null = null;
/** Builder play-tests are never saved: the map only exists in the builder's working copy. */
let savable = false;
let returnScreen: Screen = 'home';

session.confirmEndTurn = (idle) => confirmModal({
  title: 'End turn?',
  body: [`${idle === 1 ? 'One squad member still has' : `${idle} squad members still have`} actions left.`, 'You can turn this question off in Settings.'],
  cta: 'End turn', cancel: 'Keep playing',
});

/** Whether the active campaign mission's result has gone to the campaign yet (14): exactly once per mission. */
let reported = false;

/**
 * 10c: keep the current mission resumable. Every checkpoint either saves it or, once it's over, clears it.
 * 14: a campaign mission is reported the moment it's decided - not when the player leaves the results
 * screen - so closing the tab on a loss can't erase it.
 */
session.onCheckpoint = () => {
  if (!savable) return;
  const s = session.state;
  const slot = activeCampaignMissionId ? 'campaign' : 'single';
  if (s.winner) {
    clearMission(slot);
    if (activeCampaignMissionId && !reported) {
      reported = true;
      campaign.reportEnd(activeCampaignMissionId, s.units, s.winner === 'player' ? 'won' : 'lost');
    }
  } else if (s.phase === 'player') saveMission({ missionId: activeMissionId, campaignMissionId: activeCampaignMissionId, state: s });
};

/** Starts `map` fresh, or continues a saved `GameState` (10c). */
const startGame = (map: MapDef | { resume: GameState }, fromBuilder: boolean, missionId?: string) => {
  (el('dbg-fog') as HTMLInputElement).checked = true;
  el('to-builder').hidden = !fromBuilder;
  savable = !fromBuilder;
  // A campaign mission can't be replayed from the end banner: its result is reported to the campaign (13).
  el('banner-reset').hidden = activeCampaignMissionId !== null;
  // ...and can't be left for free: the mission's Menu button is a retreat (14).
  el('menu').querySelector('.lbl')!.textContent = activeCampaignMissionId ? 'Retreat' : 'Menu';
  el('banner-menu').textContent = activeCampaignMissionId ? 'Continue' : 'Main menu';
  reported = false;
  activeMissionId = missionId ?? null;
  if ('resume' in map) session.resume(map.resume);
  else session.load(map);
  showScreen('game');
  request();
  // after the screen is visible (so the scroll box has a size) and the canvas has been resized for this map
  requestAnimationFrame(() => {
    const start = session.focusTile();
    if (start) viewport.center(start.x, start.y);
  });
  const isTutorialMission = missionId === TUTORIAL_MISSION_ID;
  el('tutorial-replay').hidden = !isTutorialMission;
  if (isTutorialMission && !tutorialDismissed() && !('resume' in map)) tutorial.start();
  else tutorial.hide();
};

let builder: Builder | null = null;
let refreshHome = () => {};
if (DEBUG) {
  builder = new Builder({
    onPlay: (map) => startGame(map, true),
    onExit: () => goHome(),
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

/** The home screen, with a Resume button for each save slot that holds a mission right now. */
function goHome() {
  refreshHome();
  renderCampaignTile(campaign.hasStarted() ? campaign.campaignState() : null);
  for (const [id, slot, label] of [['home-resume', 'campaign', 'Resume campaign mission'], ['home-resume-single', 'single', 'Resume']] as const) {
    const save = loadMission(slot);
    const btn = el(id);
    btn.hidden = !save;
    if (save) btn.querySelector('.lbl')!.textContent = `${label}: ${save.state.map.name} · turn ${save.state.turn}`;
  }
  showScreen('home');
}
/** Continues the mission in `slot`, if there still is one. */
function resumeSlot(slot: SaveSlot) {
  const save = loadMission(slot);
  if (!save) return goHome();
  activeCampaignMissionId = save.campaignMissionId;
  returnScreen = save.campaignMissionId ? 'campaign' : 'home';
  startGame({ resume: save.state }, false, save.missionId ?? undefined);
}
el('home-resume').addEventListener('click', () => resumeSlot('campaign'));
el('home-resume-single').addEventListener('click', () => resumeSlot('single'));

const campaign = new Campaign({
  onPlay: (map, missionId) => { activeCampaignMissionId = missionId; returnScreen = 'campaign'; startGame(map, false, missionId); },
  onBrief: (cs, info) => { briefing.open(cs, info); showScreen('briefing'); },
  onBack: () => goHome(),
  pending: () => {
    const save = loadMission('campaign');
    return save ? { name: save.state.map.name, turn: save.state.turn } : null;
  },
  onResume: () => resumeSlot('campaign'),
  onRetreatPending: () => {
    const save = loadMission('campaign');
    clearMission('campaign');
    if (save?.campaignMissionId) campaign.reportEnd(save.campaignMissionId, save.state.units, 'retreat');
    toCampaign();
  },
  onLockerFull: () => { stash.open(campaign.campaignState()); showScreen('stash'); },
  onReset: () => clearMission('campaign'),
});
const stash = new Stash({
  onDone: () => toCampaign(),
  onLoadout: () => { equip.open(campaign.campaignState()); showScreen('equip'); },
});
const briefing = new Briefing({ onBack: () => showScreen('campaign'), onDeploy: (squad) => campaign.deploy(squad) });
/** Campaign.open() is async (it may queue a debrief and a district briefing); nothing waits on it. */
const toCampaign = () => { showScreen('campaign'); void campaign.open(); };
el('home-campaign').addEventListener('click', toCampaign);
const lore = new Lore({ onBack: () => goHome(), onCampaign: toCampaign });
const toLore = () => { lore.open(campaign.hasStarted() ? campaign.campaignState() : null); showScreen('lore'); };
el('home-lore').addEventListener('click', toLore);
el('home-lore-top').addEventListener('click', toLore);

const base = new Base({ onBack: toCampaign });
el('campaign-to-base').addEventListener('click', () => { base.open(campaign.campaignState()); showScreen('base'); });

const equip = new Equip({ onBack: toCampaign });
el('campaign-to-equip').addEventListener('click', () => { equip.open(campaign.campaignState()); showScreen('equip'); });

/** Leaves the mission screen. A finished campaign mission has already been reported (see onCheckpoint). */
const toMenu = () => {
  session.leave();
  activeCampaignMissionId = null;
  if (returnScreen === 'campaign') toCampaign();
  else goHome();
};
/**
 * The mission's Menu button. A single mission just saves and leaves (resumable). A campaign mission still
 * being fought is a retreat (14): asked first, then reported as one - unless playing out the enemy phase
 * that was running decides the mission first, in which case that result stands.
 */
el('menu').addEventListener('click', async () => {
  const id = activeCampaignMissionId;
  if (id && !session.state.winner) {
    if (!(await confirmRetreat())) return;
    session.leave();
    if (!session.state.winner && !reported) {
      reported = true;
      savable = false; // leaving the screen must not save the mission we just retreated from
      clearMission('campaign');
      campaign.reportEnd(id, session.state.units, 'retreat');
    }
  }
  toMenu();
});
el('banner-menu').addEventListener('click', toMenu);

// Settings can be opened from the home screen or mid-mission; remember which to return to.
let settingsReturnTo: Screen = 'home';
initSettings({ onBack: () => (settingsReturnTo === 'home' ? goHome() : showScreen(settingsReturnTo)), onPaletteChange: () => request() });
el('home-settings').addEventListener('click', () => { settingsReturnTo = 'home'; showScreen('settings'); });
el('game-settings').addEventListener('click', () => { settingsReturnTo = 'game'; showScreen('settings'); });

goHome();

if (DEBUG) (window as unknown as { session: Session }).session = session; // handy in the devtools console
