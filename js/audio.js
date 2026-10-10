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
