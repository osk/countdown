import { state } from './state.js';
import {
  URGENT_AT_SECS_REMAINING,
  CRITICAL_AT_SECS_REMAINING,
  MODE_TORCH,
} from './constants.js';

/**
 * Looks up a required element by id, throws if not found.
 * @param {string} id
 * @returns {HTMLElement}
 */
function reqEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found in DOM`);
  return el;
}

/**
 * @param {string} id
 * @returns {HTMLInputElement}
 */
function reqInput(id) {
  const el = reqEl(id);
  if (!(el instanceof HTMLInputElement))
    throw new Error(`#${id} is not an <input>`);
  return el;
}

export const stage = reqEl('stage');
export const displayEl = reqEl('display');
export const timeEl = reqEl('time');
export const controlsEl = reqEl('controls');
export const nudgeUpBtn = reqEl('nudgeUpBtn');
export const nudgeDownBtn = reqEl('nudgeDownBtn');
export const resetBtn = reqEl('resetBtn');
export const standbyBtn = reqEl('standbyBtn');
export const muteBtn = reqEl('muteBtn');
export const settingsBtn = reqEl('settingsBtn');
export const fullscreenBtn = reqEl('fullscreenBtn');
export const overlay = reqEl('settingsOverlay');
export const settingsTitleEl = reqEl('settingsTitle');
export const setMinutesInput = reqInput('setMinutes');
export const setSecondsInput = reqInput('setSeconds');
export const minDownBtn = reqEl('minDownBtn');
export const minUpBtn = reqEl('minUpBtn');
export const secDownBtn = reqEl('secDownBtn');
export const secUpBtn = reqEl('secUpBtn');
export const setSoundInput = reqInput('setSound');
export const setScanlineInput = reqInput('setScanline');
export const setGlowInput = reqInput('setGlow');
export const setEmbersInput = reqInput('setEmbers');
export const setFlameGlowInput = reqInput('setFlameGlow');
export const saveSettingsBtn = reqEl('saveSettings');
export const cancelSettingsBtn = reqEl('cancelSettings');
export const testDingBtn = reqEl('testDing');
export const testFinalBtn = reqEl('testFinal');
export const modeElevatorBtn = reqEl('modeElevatorBtn');
export const modeTorchBtn = reqEl('modeTorchBtn');
export const effectsElevatorEl = reqEl('effectsElevator');
export const effectsTorchEl = reqEl('effectsTorch');
export const debugScanlineInput = reqInput('debugScanline');

/**
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function render() {
  const secondsLeft = Math.max(0, Math.ceil(state.remainingMs / 1000));
  timeEl.textContent = formatTime(secondsLeft);

  stage.classList.toggle(
    'urgent',
    secondsLeft <= URGENT_AT_SECS_REMAINING && secondsLeft > 0,
  );
  stage.classList.toggle(
    'critical',
    secondsLeft <= CRITICAL_AT_SECS_REMAINING && secondsLeft > 0,
  );
  stage.classList.toggle(
    'paused',
    !state.running && !state.locked && secondsLeft !== state.totalSeconds,
  );

  // Torch burns down gradually rather than only dimming in the final
  // seconds — not meant to track in lockstep with the clock, just give a
  // sense of the flame weakening as the hour wears on.
  if (state.mode === MODE_TORCH && state.totalSeconds > 0) {
    const burnFraction = Math.max(0, Math.min(1, secondsLeft / state.totalSeconds));
    stage.style.setProperty('--torch-burn', burnFraction.toFixed(3));
  }
}

export function updateMuteButton() {
  muteBtn.classList.toggle('muted', !state.soundEnabled);
  muteBtn.textContent = state.soundEnabled ? '♪' : '✕';
}

export function updateGlow() {
  stage.classList.toggle('glow', state.glowEnabled && state.mode !== MODE_TORCH);
  stage.classList.toggle(
    'flame-glow',
    state.torchGlowEnabled && state.mode === MODE_TORCH,
  );
}

export function updateTheme() {
  document.documentElement.classList.toggle('theme-torch', state.mode === MODE_TORCH);
}

export function updateEmbers() {
  stage.classList.toggle(
    'embers-active',
    state.torchEmbersEnabled && state.mode === MODE_TORCH,
  );
}
