import { state } from '../state.js';
import { stage } from '../dom.js';
import {
  primeAudio,
  torchGutterSound,
  torchCracklePopSound,
  torchExtinguishSound,
  torchIgniteSound,
  torchCreakSound,
} from '../audio.js';
import {
  MODE_TORCH,
  TORCH_DEFAULT_MINUTES,
  TORCH_DEFAULT_SECONDS,
  TORCH_EXTINGUISH_MS,
  TORCH_IGNITE_MS,
  TORCH_CREAK_MIN_MS,
  TORCH_CREAK_MAX_MS,
} from '../constants.js';

// Irregular-interval creak while the torch is out, same shape as the
// scanline sweep's random scheduling.
/** @type {ReturnType<typeof setTimeout>|null} */
let ambienceTimer = null;

function scheduleCreak() {
  const delay =
    TORCH_CREAK_MIN_MS + Math.random() * (TORCH_CREAK_MAX_MS - TORCH_CREAK_MIN_MS);
  ambienceTimer = setTimeout(() => {
    torchCreakSound();
    scheduleCreak();
  }, delay);
}

function stopAmbience() {
  clearTimeout(ambienceTimer ?? undefined);
  ambienceTimer = null;
}

/**
 * Shadowdark torch theme — a guttering flame rather than an LCD floor
 * indicator. It doesn't loop: when it burns out the screen goes dark and
 * near-silent but for the occasional creak, until a tap relights it. See
 * styles/themes/torch.css for the matching visuals.
 */
export const torchTheme = {
  id: MODE_TORCH,
  defaultMinutes: TORCH_DEFAULT_MINUTES,
  defaultSeconds: TORCH_DEFAULT_SECONDS,

  finalTick: torchGutterSound,
  minuteTick: torchCracklePopSound,

  /**
   * Gutters out over TORCH_EXTINGUISH_MS, then falls into standby instead
   * of restarting — the torch stays dead until relit.
   * @param {{enterStandby: () => void}} ctx
   */
  runZeroSequence({ enterStandby }) {
    stage.classList.add('torch-extinguishing');
    torchExtinguishSound();
    state.zeroTimeout = setTimeout(() => {
      state.zeroTimeout = null;
      enterStandby();
    }, TORCH_EXTINGUISH_MS);
  },

  /**
   * Relighting: a rough catching-light burst instead of the elevator's
   * smooth CRT power-on.
   * @param {() => void} onComplete
   */
  runWakeSequence(onComplete) {
    stage.classList.add('torch-igniting');
    primeAudio().then(() => torchIgniteSound());
    state.wakeTimeout = setTimeout(() => {
      state.wakeTimeout = null;
      stage.classList.remove('torch-igniting');
      onComplete();
    }, TORCH_IGNITE_MS);
  },

  enterDarkness() {
    stopAmbience();
    scheduleCreak();
  },

  exitDarkness() {
    stopAmbience();
  },

  clearTransientClasses() {
    stage.classList.remove('torch-extinguishing', 'torch-igniting');
  },
};
