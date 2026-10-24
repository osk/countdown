import {
  STORAGE_KEY,
  MODE_ELEVATOR,
  MODE_TORCH,
  DEFAULT_MINUTES,
  DEFAULT_SECONDS,
  TORCH_DEFAULT_MINUTES,
  TORCH_DEFAULT_SECONDS,
} from './constants.js';

/**
 * @typedef {Object} AppState
 * @property {'elevator'|'torch'} mode - which countdown theme is active
 * @property {number} elevatorTotalSeconds - remembered elevator duration, in seconds
 * @property {number} torchTotalSeconds - remembered torch duration, in seconds
 * @property {number} totalSeconds - configured duration for the active mode, in seconds
 * @property {number} remainingMs - live countdown value, in milliseconds
 * @property {boolean} running
 * @property {boolean} locked - true during the zero-moment transition
 * @property {boolean} standby - true while blacked out, waiting for a tap/Space to wake
 * @property {number|null} endTimestamp - Date.now()-based deadline while running
 * @property {number|null} rafId - current requestAnimationFrame handle
 * @property {number|null} lastWholeSecond - last second boundary rendered, to dedupe per-second work
 * @property {boolean} soundEnabled
 * @property {boolean} scanlineEnabled
 * @property {boolean} glowEnabled
 * @property {boolean} torchEmbersEnabled
 * @property {boolean} torchGlowEnabled
 * @property {ReturnType<typeof setTimeout>|null} zeroTimeout - pending step in the zero-moment sequence
 * @property {ReturnType<typeof setTimeout>|null} wakeTimeout - pending countdown start after standby wake
 * @property {boolean} wasRunningBeforeSettings - resume flag for Settings cancel/close
 */

/**
 * @returns {{mode: 'elevator'|'torch', elevatorMinutes: number, elevatorSeconds: number, torchMinutes: number, torchSeconds: number, soundEnabled: boolean, scanlineEnabled: boolean, glowEnabled: boolean, torchEmbersEnabled: boolean, torchGlowEnabled: boolean}}
 */
function loadSettings() {
  /** @type {{mode: 'elevator'|'torch', elevatorMinutes: number, elevatorSeconds: number, torchMinutes: number, torchSeconds: number, soundEnabled: boolean, scanlineEnabled: boolean, glowEnabled: boolean, torchEmbersEnabled: boolean, torchGlowEnabled: boolean}} */
  const fallback = {
    mode: MODE_ELEVATOR,
    elevatorMinutes: DEFAULT_MINUTES,
    elevatorSeconds: DEFAULT_SECONDS,
    torchMinutes: TORCH_DEFAULT_MINUTES,
    torchSeconds: TORCH_DEFAULT_SECONDS,
    soundEnabled: true,
    scanlineEnabled: true,
    glowEnabled: false,
    torchEmbersEnabled: true,
    torchGlowEnabled: false,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    // Pre-torch-mode saves stored a single minutes/seconds pair for the
    // (then only) elevator countdown — treat that as the elevator duration
    // and leave the torch side on its default.
    const legacyMinutes = Number.isFinite(parsed.minutes)
      ? parsed.minutes
      : null;
    const legacySeconds = Number.isFinite(parsed.seconds)
      ? parsed.seconds
      : null;
    return {
      mode: parsed.mode === MODE_TORCH ? MODE_TORCH : MODE_ELEVATOR,
      elevatorMinutes: Number.isFinite(parsed.elevatorMinutes)
        ? parsed.elevatorMinutes
        : (legacyMinutes ?? DEFAULT_MINUTES),
      elevatorSeconds: Number.isFinite(parsed.elevatorSeconds)
        ? parsed.elevatorSeconds
        : (legacySeconds ?? DEFAULT_SECONDS),
      torchMinutes: Number.isFinite(parsed.torchMinutes)
        ? parsed.torchMinutes
        : TORCH_DEFAULT_MINUTES,
      torchSeconds: Number.isFinite(parsed.torchSeconds)
        ? parsed.torchSeconds
        : TORCH_DEFAULT_SECONDS,
      soundEnabled: parsed.soundEnabled !== false,
      scanlineEnabled: parsed.scanlineEnabled !== false,
      glowEnabled: parsed.glowEnabled === true,
      torchEmbersEnabled: parsed.torchEmbersEnabled !== false,
      torchGlowEnabled: parsed.torchGlowEnabled === true,
    };
  } catch {
    return fallback;
  }
}

const saved = loadSettings();
const elevatorTotalSeconds = saved.elevatorMinutes * 60 + saved.elevatorSeconds;
const torchTotalSeconds = saved.torchMinutes * 60 + saved.torchSeconds;
const initialTotalSeconds =
  saved.mode === MODE_TORCH ? torchTotalSeconds : elevatorTotalSeconds;

// Single mutable store shared by every module.
/** @type {AppState} */
export const state = {
  mode: saved.mode,
  elevatorTotalSeconds,
  torchTotalSeconds,
  totalSeconds: initialTotalSeconds,
  remainingMs: initialTotalSeconds * 1000,
  running: false,
  locked: false,
  standby: false,
  endTimestamp: null,
  rafId: null,
  lastWholeSecond: null,
  soundEnabled: saved.soundEnabled,
  scanlineEnabled: saved.scanlineEnabled,
  glowEnabled: saved.glowEnabled,
  torchEmbersEnabled: saved.torchEmbersEnabled,
  torchGlowEnabled: saved.torchGlowEnabled,
  zeroTimeout: null,
  wakeTimeout: null,
  wasRunningBeforeSettings: false,
};

export function persistSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        elevatorMinutes: Math.floor(state.elevatorTotalSeconds / 60),
        elevatorSeconds: state.elevatorTotalSeconds % 60,
        torchMinutes: Math.floor(state.torchTotalSeconds / 60),
        torchSeconds: state.torchTotalSeconds % 60,
        soundEnabled: state.soundEnabled,
        scanlineEnabled: state.scanlineEnabled,
        glowEnabled: state.glowEnabled,
        torchEmbersEnabled: state.torchEmbersEnabled,
        torchGlowEnabled: state.torchGlowEnabled,
      }),
    );
  } catch {
    // Storage blocked or full
  }
}
