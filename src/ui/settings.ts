import { ACTION_LABEL, BINDABLE_ACTIONS, displayKey, keyOf, RESERVED_KEY, type BindableAction } from './keybindings';
import { actionUsing, getBindings, rebindAction, resetBindings } from './input';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface SettingsHooks {
  onBack: () => void;
}

/** Keybindings settings screen: list every rebindable action, "click then press a key" to rebind, reset all. */
export function initSettings(hooks: SettingsHooks): () => void {
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
