import { state } from './state.js';
import { URGENT_AT_SECS_REMAINING } from './constants.js';

// synthesized sounds

/** @type {AudioContext|null} */
let audioCtx = null;

/** @returns {AudioContext} */
function ensureAudio() {
  if (!audioCtx) {
    // Safari ships WebKit's prefixed constructor; not in lib.dom's Window type.
    const Ctor =
      window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/**
 * Get the ready audio context
 * @returns {Promise<AudioContext>}
 */
export function primeAudio() {
  const ctx = ensureAudio();
  return ctx.state === 'running'
    ? Promise.resolve(ctx)
    : ctx.resume().then(() => ctx);
}

/**
 * @typedef {Object} ToneOpts
 * @property {number} [duration]
 * @property {number} [gain]
 * @property {number} [when] - seconds from now
 * @property {OscillatorType} [type]
 * @property {Array<{ratio: number, gain: number}>} [overtones]
 * @property {number|null} [lowpass] - cutoff Hz, or null to skip filtering
 */

/**
 * @param {number} freq
 * @param {ToneOpts} [opts]
 */
function tone(
  freq,
  {
    duration = 0.5,
    gain = 0.15,
    when = 0,
    type = 'sine',
    overtones = [{ ratio: 2, gain: 0.25 }],
    lowpass = null,
  } = {},
) {
  if (!state.soundEnabled) return;
  const ctx = ensureAudio();
  const t0 = ctx.currentTime + when;

  /** @param {number} f @param {number} g */
  const pluck = (f, g) => {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(g, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    /** @type {AudioNode} */
    let output = osc;
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      filter.Q.value = 0.7;
      osc.connect(filter);
      output = filter;
    }
    output.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  };

  pluck(freq, gain);
  for (const { ratio, gain: overtoneGain } of overtones) {
    pluck(freq * ratio, gain * overtoneGain);
  }
}

/**
 * @typedef {Object} NoiseOpts
 * @property {number} [duration]
 * @property {number} [gain]
 * @property {number} [when] - seconds from now
 * @property {number|null} [lowpass] - cutoff Hz, or null to skip
 */

/** Short burst of filtered white noise — crackle, hiss, sputter, creak. */
/** @param {NoiseOpts} [opts] */
function noiseBurst({ duration = 0.15, gain = 0.2, when = 0, lowpass = 2000 } = {}) {
  if (!state.soundEnabled) return;
  const ctx = ensureAudio();
  const t0 = ctx.currentTime + when;

  const bufferSize = Math.max(1, Math.ceil(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  /** @type {AudioNode} */
  let output = src;
  if (lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    output.connect(filter);
    output = filter;
  }
  output.connect(amp).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

/** Tick on the minute mark */
export function minuteTick() {
  tone(130.81, {
    duration: 1.1,
    gain: 0.16,
    type: 'sine',
    overtones: [{ ratio: 2, gain: 0.3 }],
  });
  tone(65.41, { duration: 1.1, gain: 0.14, type: 'sine', overtones: [] });
}

/**
 * Final countdown.
 * @param {number} secondsLeft
 */
export function urgentTick(secondsLeft) {
  const intensity =
    (URGENT_AT_SECS_REMAINING - secondsLeft) / URGENT_AT_SECS_REMAINING;
  const beepCount = secondsLeft <= 2 ? 3 : 2;
  const gap = 0.14;
  const freq = 180 + intensity * 40;
  const gain = 0.22 + intensity * 0.2;

  for (let i = 0; i < beepCount; i++) {
    const when = i * gap;
    tone(freq, {
      duration: 0.13,
      gain,
      type: 'square',
      overtones: [],
      lowpass: 650,
      when,
    });
    tone(freq / 2, {
      duration: 0.16,
      gain: gain * 0.8,
      type: 'sine',
      overtones: [],
      when,
    });
  }
}

/** Elevator arrival ding */
export function elevatorArrival() {
  const bell = [
    { ratio: 2, gain: 0.3 },
    { ratio: 2.76, gain: 0.12 },
  ];
  tone(880, { duration: 0.7, gain: 0.3, type: 'sine', overtones: bell });
  tone(659.25, {
    duration: 0.9,
    gain: 0.28,
    type: 'sine',
    overtones: bell,
    when: 0.35,
  });
  tone(90, {
    duration: 0.5,
    gain: 0.3,
    type: 'sine',
    overtones: [],
    when: 1.0,
  });
}

/** Final alarm. */
export function zeroAlarm() {
  if (!state.soundEnabled) return;
  const ctx = ensureAudio();
  const t0 = ctx.currentTime;
  const duration = 1.8;
  const cycles = 3;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 480;
  filter.Q.value = 1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.4, t0 + 0.02);
  gain.gain.setValueAtTime(0.4, t0 + duration - 0.15);
  gain.gain.linearRampToValueAtTime(0.0001, t0 + duration);
  filter.connect(gain).connect(ctx.destination);

  /** @param {number} detuneCents */
  const makeSiren = (detuneCents) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = detuneCents;
    const segment = duration / cycles;
    for (let i = 0; i <= cycles; i++) {
      const freq = i % 2 === 0 ? 90 : 240;
      osc.frequency.linearRampToValueAtTime(freq, t0 + i * segment);
    }
    osc.connect(filter);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  };
  makeSiren(0);
  makeSiren(-12);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(55, t0);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0, t0);
  subGain.gain.linearRampToValueAtTime(0.3, t0 + 0.02);
  subGain.gain.setValueAtTime(0.3, t0 + duration - 0.15);
  subGain.gain.linearRampToValueAtTime(0.0001, t0 + duration);

  sub.connect(subGain).connect(ctx.destination);
  sub.start(t0);
  sub.stop(t0 + duration + 0.05);
}

/**
 * Shadowdark torch theme sounds — fire crackle and low dread instead of
 * clean synth tones. Timing/CSS choreography live in js/themes/torch.js;
 * these are just the single-shot sound primitives it reaches for.
 */

/** Guttering flame in the final seconds before it dies. */
/** @param {number} secondsLeft */
export function torchGutterSound(secondsLeft) {
  const intensity =
    (URGENT_AT_SECS_REMAINING - secondsLeft) / URGENT_AT_SECS_REMAINING;
  noiseBurst({
    duration: 0.22 + intensity * 0.1,
    gain: 0.16 + intensity * 0.12,
    lowpass: 1300 - intensity * 500,
  });
  tone(68 + intensity * 18, {
    duration: 0.3,
    gain: 0.1 + intensity * 0.1,
    type: 'sine',
    overtones: [],
  });
}

/** A quiet crackle/pop marking a minute passing, in place of the elevator's bell. */
export function torchCracklePopSound() {
  noiseBurst({ duration: 0.12, gain: 0.08, lowpass: 2600 });
}

/** The torch sputters out: a dying hiss under a slow, ominous drone swell. */
export function torchExtinguishSound() {
  if (!state.soundEnabled) return;
  noiseBurst({ duration: 1.1, gain: 0.3, lowpass: 500 });

  const ctx = ensureAudio();
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, t0);
  osc.frequency.exponentialRampToValueAtTime(36, t0 + 2.2);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.22, t0 + 0.3);
  gain.gain.linearRampToValueAtTime(0.0001, t0 + 2.4);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 2.5);
}

/** A faint settling creak/whisper while the torch is out. */
export function torchCreakSound() {
  noiseBurst({
    duration: 0.5 + Math.random() * 0.4,
    gain: 0.05,
    lowpass: 350 + Math.random() * 300,
  });
}

/** Catching light: a whoosh, a few crackling pops, then it steadies. */
export function torchIgniteSound() {
  if (!state.soundEnabled) return;
  noiseBurst({ duration: 0.4, gain: 0.32, lowpass: 3200 });
  for (let i = 0; i < 4; i++) {
    noiseBurst({
      duration: 0.08 + Math.random() * 0.05,
      gain: 0.12,
      when: 0.3 + i * 0.12,
      lowpass: 1800,
    });
  }
}
