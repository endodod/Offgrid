import { ACTION_LABEL, BINDABLE_ACTIONS, displayKey, keyOf, RESERVED_KEY, type BindableAction } from './keybindings';
import { actionUsing, getBindings, rebindAction, resetBindings } from './input';
import { setColorblind } from '../render/renderer';
import { applyVolume, play } from './audio';
import { getPrefs, setPrefs } from './prefs';
import { seg } from './seg';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface SettingsHooks {
  onBack: () => void;
  onPaletteChange: () => void;
}

const SPEEDS = [
  { value: '0', label: 'Instant', title: 'No animation: results appear at once' },
  { value: '2', label: 'Fast' },
  { value: '1', label: 'Normal' },
  { value: '0.6', label: 'Slow' },
];

/** Applies the palette preference to both the CSS tokens and the canvas. Call once at boot. */
export function applyPalette() {
  const cb = getPrefs().colorblind;
  document.documentElement.dataset.palette = cb ? 'cb' : '';
  setColorblind(cb);
}

/** The "Game" group (10f): presentation preferences only, stored in ui/prefs.ts. `onPalette` redraws the board. */
function initGameSettings(onPalette: () => void) {
  const p = getPrefs();
  const vol = $<HTMLInputElement>('set-volume');
  vol.value = String(Math.round(p.volume * 100));
  vol.addEventListener('input', () => { setPrefs({ volume: Number(vol.value) / 100 }); applyVolume(); });
  vol.addEventListener('change', () => play('shot')); // a sample at the new level, once the slider is let go
  const nearest = SPEEDS.reduce((a, b) => (Math.abs(Number(b.value) - p.animSpeed) < Math.abs(Number(a.value) - p.animSpeed) ? b : a));
  seg($('set-speed'), SPEEDS, nearest.value, (v) => setPrefs({ animSpeed: Number(v) }));
  const shake = $<HTMLInputElement>('set-shake');
  shake.checked = p.shake;
  shake.addEventListener('change', () => setPrefs({ shake: shake.checked }));
  const weather = $<HTMLInputElement>('set-weather');
  weather.checked = p.weatherFx;
  weather.addEventListener('change', () => setPrefs({ weatherFx: weather.checked }));
  const confirmEnd = $<HTMLInputElement>('set-confirm-end');
  confirmEnd.checked = p.confirmEndTurn;
  confirmEnd.addEventListener('change', () => setPrefs({ confirmEndTurn: confirmEnd.checked }));
  const cb = $<HTMLInputElement>('set-cb');
  cb.checked = p.colorblind;
  cb.addEventListener('change', () => { setPrefs({ colorblind: cb.checked }); applyPalette(); onPalette(); });
}

/** Settings screen: the game preferences, then every rebindable action ("click then press a key"), reset all. */
export function initSettings(hooks: SettingsHooks): () => void {
  initGameSettings(hooks.onPaletteChange);
  let listening: BindableAction | null = null;
  let message = '';

  const render = () => {
    $('kb-list').innerHTML = BINDABLE_ACTIONS.map((a) => `
      <div class="kb-row">
        <span>${ACTION_LABEL[a]}</span>
        <button data-rebind="${a}" class="${listening === a ? 'is-listening' : ''}">${listening === a ? 'Press a key...' : displayKey(getBindings()[a])}</button>
      </div>`).join('');
    $('kb-msg').textContent = message;
  };

  $('kb-list').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rebind]');
    if (!b) return;
    listening = b.dataset.rebind as BindableAction;
    message = '';
    render();
  });

  window.addEventListener('keydown', (ev) => {
    if (!listening || $('settings').hidden) return;
    ev.preventDefault();
    const action = listening;
    listening = null;
    if (ev.key === RESERVED_KEY) { message = `${RESERVED_KEY} always cancels; rebind aborted.`; render(); return; }
    const key = keyOf(ev);
    if (key.startsWith('Arrow')) { message = 'Arrow keys always pan the camera; rebind aborted.'; render(); return; }
    const already = actionUsing(key, action);
    if (already) { message = `"${displayKey(key)}" is already bound to ${ACTION_LABEL[already]}.`; render(); return; }
    rebindAction(action, key);
    message = `${ACTION_LABEL[action]} is now "${displayKey(key)}".`;
    render();
  });

  $('kb-reset').addEventListener('click', () => {
    resetBindings();
    message = 'Reset to defaults.';
    render();
  });
  $('kb-back').addEventListener('click', () => { listening = null; hooks.onBack(); });

  render();
  return render;
}
