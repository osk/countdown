import { STORAGE_KEY, DEFAULT_MINUTES, DEFAULT_SECONDS } from './constants.js';

/**
 * @typedef {Object} AppState
 * @property {number} totalSeconds - configured duration, in seconds
 * @property {number} remainingMs - live countdown value, in milliseconds
 * @property {boolean} running
 * @property {boolean} locked - true during the elevator-doors transition at zero
 * @property {boolean} standby - true while blacked out after R, waiting for Space to wake
 * @property {number|null} endTimestamp - Date.now()-based deadline while running
 * @property {number|null} rafId - current requestAnimationFrame handle
 * @property {number|null} lastWholeSecond - last second boundary rendered, to dedupe per-second work
 * @property {boolean} soundEnabled
 * @property {boolean} scanlineEnabled
 * @property {boolean} glowEnabled
 * @property {ReturnType<typeof setTimeout>|null} zeroTimeout - pending step in the zero-moment sequence
 * @property {ReturnType<typeof setTimeout>|null} wakeTimeout - pending countdown start after standby wake
 * @property {boolean} wasRunningBeforeSettings - resume flag for Settings cancel/close
 */

/**
 * @returns {{minutes: number, seconds: number, soundEnabled: boolean, scanlineEnabled: boolean, glowEnabled: boolean}}
 */
function loadSettings() {
  const fallback = {
    minutes: DEFAULT_MINUTES,
    seconds: DEFAULT_SECONDS,
    soundEnabled: true,
    scanlineEnabled: true,
    glowEnabled: false,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      minutes: Number.isFinite(parsed.minutes)
        ? parsed.minutes
        : DEFAULT_MINUTES,
      seconds: Number.isFinite(parsed.seconds)
        ? parsed.seconds
        : DEFAULT_SECONDS,
      soundEnabled: parsed.soundEnabled !== false,
      scanlineEnabled: parsed.scanlineEnabled !== false,
      glowEnabled: parsed.glowEnabled === true,
    };
  } catch {
    return fallback;
  }
}

const saved = loadSettings();

// Single mutable store shared by every module.
/** @type {AppState} */
export const state = {
  totalSeconds: saved.minutes * 60 + saved.seconds,
  remainingMs: (saved.minutes * 60 + saved.seconds) * 1000,
  running: false,
  locked: false,
  standby: false,
  endTimestamp: null,
  rafId: null,
  lastWholeSecond: null,
  soundEnabled: saved.soundEnabled,
  scanlineEnabled: saved.scanlineEnabled,
  glowEnabled: saved.glowEnabled,
  zeroTimeout: null,
  wakeTimeout: null,
  wasRunningBeforeSettings: false,
};

export function persistSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        minutes: Math.floor(state.totalSeconds / 60),
        seconds: state.totalSeconds % 60,
        soundEnabled: state.soundEnabled,
        scanlineEnabled: state.scanlineEnabled,
        glowEnabled: state.glowEnabled,
      }),
    );
  } catch {
    // Storage blocked or full
  }
}
