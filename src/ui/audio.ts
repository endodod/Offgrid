import { getPrefs } from './prefs';

/**
 * Procedural sound effects (10e). Every sound is synthesized with WebAudio - noise bursts, oscillators and
 * envelopes - so there are no files to license, load or cache, and the whole set fits in this module.
 *
 * Browsers only allow audio after a user gesture, so the context is created on the first pointer or key press
 * (`unlockAudio`). Before that every call is a silent no-op; nothing here ever throws into the game.
 */
export type Sound =
  | 'select' | 'click' | 'error' | 'step' | 'shot' | 'shotHeavy' | 'hit' | 'miss' | 'throw' | 'blast'
  | 'down' | 'death' | 'heal' | 'pickup' | 'door' | 'switch' | 'reload' | 'overwatch' | 'scan'
  | 'phasePlayer' | 'phaseEnemy' | 'win' | 'lose';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  try {
    const AC = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

/** Re-read the volume preference (10f calls this when the slider moves). */
export function applyVolume() {
  if (master && ctx) master.gain.setValueAtTime(getPrefs().volume * 0.5, ctx.currentTime);
}

/** Play `sound` now, or `delayMs` from now - scheduled on the audio clock, so it stays in sync with playback. */
export function play(sound: Sound, delayMs = 0) {
  if (!ctx || !master || !noise || getPrefs().volume <= 0) return;
  try {
    RECIPES[sound](ctx.currentTime + Math.max(0, delayMs) / 1000);
  } catch { /* a sound is never worth breaking the game over */ }
}

// ---------- building blocks ----------
/** A gain envelope: attack to `peak`, exponential decay over `decay` seconds. Returns the node to feed. */
function env(at: number, peak: number, decay: number, attack = 0.004): GainNode {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(master!);
  return g;
}

function burst(at: number, { peak, decay, type = 'lowpass', freq, freqTo, q = 0.8, rate = 1 }: { peak: number; decay: number; type?: BiquadFilterType; freq: number; freqTo?: number; q?: number; rate?: number }) {
  const src = ctx!.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = rate;
  const f = ctx!.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, at);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, at + decay);
  src.connect(f).connect(env(at, peak, decay));
  src.start(at, Math.random() * 0.5);
  src.stop(at + decay + 0.05);
}

function tone(at: number, { peak, decay, freq, freqTo, type = 'sine', attack }: { peak: number; decay: number; freq: number; freqTo?: number; type?: OscillatorType; attack?: number }) {
  const o = ctx!.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, at + decay);
  o.connect(env(at, peak, decay, attack));
  o.start(at);
  o.stop(at + (attack ?? 0.004) + decay + 0.05);
}

const RECIPES: Record<Sound, (at: number) => void> = {
  select: (at) => tone(at, { peak: 0.12, decay: 0.07, freq: 880, freqTo: 1320, type: 'triangle' }),
  click: (at) => tone(at, { peak: 0.08, decay: 0.04, freq: 1400, type: 'square' }),
  error: (at) => { tone(at, { peak: 0.1, decay: 0.12, freq: 180, type: 'square' }); tone(at + 0.09, { peak: 0.1, decay: 0.14, freq: 140, type: 'square' }); },
  step: (at) => burst(at, { peak: 0.05, decay: 0.05, type: 'bandpass', freq: 900, q: 2 }),
  shot: (at) => { burst(at, { peak: 0.5, decay: 0.13, freq: 5000, freqTo: 600 }); tone(at, { peak: 0.25, decay: 0.08, freq: 160, freqTo: 60 }); },
  shotHeavy: (at) => { burst(at, { peak: 0.65, decay: 0.3, freq: 3500, freqTo: 300 }); tone(at, { peak: 0.4, decay: 0.2, freq: 110, freqTo: 40 }); },
  hit: (at) => { burst(at, { peak: 0.3, decay: 0.08, type: 'bandpass', freq: 500, q: 1.5 }); tone(at, { peak: 0.2, decay: 0.1, freq: 120, freqTo: 70, type: 'triangle' }); },
  miss: (at) => burst(at, { peak: 0.12, decay: 0.18, type: 'bandpass', freq: 3000, freqTo: 900, q: 6 }),
  throw: (at) => burst(at, { peak: 0.08, decay: 0.3, type: 'bandpass', freq: 700, freqTo: 1600, q: 3 }),
  blast: (at) => { burst(at, { peak: 0.9, decay: 0.9, freq: 1800, freqTo: 80, rate: 0.6 }); tone(at, { peak: 0.6, decay: 0.6, freq: 90, freqTo: 30 }); },
  down: (at) => tone(at, { peak: 0.18, decay: 0.35, freq: 330, freqTo: 140, type: 'triangle' }),
  death: (at) => { tone(at, { peak: 0.2, decay: 0.6, freq: 220, freqTo: 55, type: 'sawtooth' }); burst(at, { peak: 0.1, decay: 0.3, freq: 400 }); },
  heal: (at) => { tone(at, { peak: 0.12, decay: 0.15, freq: 660, type: 'triangle' }); tone(at + 0.09, { peak: 0.12, decay: 0.25, freq: 990, type: 'triangle' }); },
  pickup: (at) => { tone(at, { peak: 0.1, decay: 0.06, freq: 1200, type: 'square' }); tone(at + 0.06, { peak: 0.1, decay: 0.1, freq: 1800, type: 'square' }); },
  door: (at) => { burst(at, { peak: 0.25, decay: 0.25, freq: 600, freqTo: 200, q: 3 }); tone(at + 0.18, { peak: 0.2, decay: 0.08, freq: 90, type: 'triangle' }); },
  switch: (at) => { tone(at, { peak: 0.15, decay: 0.03, freq: 2400, type: 'square' }); burst(at + 0.02, { peak: 0.15, decay: 0.05, type: 'highpass', freq: 3000 }); },
  reload: (at) => { burst(at, { peak: 0.2, decay: 0.05, type: 'highpass', freq: 2000 }); burst(at + 0.18, { peak: 0.25, decay: 0.07, type: 'bandpass', freq: 1500, q: 2 }); },
  overwatch: (at) => { tone(at, { peak: 0.08, decay: 0.2, freq: 520, type: 'sine' }); tone(at + 0.12, { peak: 0.08, decay: 0.3, freq: 780, type: 'sine' }); },
  scan: (at) => tone(at, { peak: 0.14, decay: 0.7, freq: 300, freqTo: 1800, type: 'sine', attack: 0.05 }),
  phasePlayer: (at) => { tone(at, { peak: 0.1, decay: 0.2, freq: 440, type: 'triangle' }); tone(at + 0.12, { peak: 0.1, decay: 0.35, freq: 660, type: 'triangle' }); },
  phaseEnemy: (at) => { tone(at, { peak: 0.14, decay: 0.3, freq: 196, type: 'sawtooth' }); tone(at + 0.16, { peak: 0.14, decay: 0.45, freq: 147, type: 'sawtooth' }); },
  win: (at) => [523, 659, 784, 1047].forEach((f, i) => tone(at + i * 0.12, { peak: 0.14, decay: 0.5, freq: f, type: 'triangle' })),
  lose: (at) => [392, 330, 262, 196].forEach((f, i) => tone(at + i * 0.18, { peak: 0.14, decay: 0.6, freq: f, type: 'sawtooth' })),
};
