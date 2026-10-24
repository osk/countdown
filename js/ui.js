import { state, persistSettings } from './state.js';
import { setScanlineContinuous, setScanlineEnabled } from './scanline.js';
import { getTheme } from './themes/index.js';
import {
  stage,
  controlsEl,
  nudgeUpBtn,
  nudgeDownBtn,
  resetBtn,
  standbyBtn,
  muteBtn,
  settingsBtn,
  fullscreenBtn,
  overlay,
  settingsTitleEl,
  setMinutesInput,
  setSecondsInput,
  minDownBtn,
  minUpBtn,
  secDownBtn,
  secUpBtn,
  setSoundInput,
  setScanlineInput,
  setGlowInput,
  setEmbersInput,
  setFlameGlowInput,
  modeElevatorBtn,
  modeTorchBtn,
  effectsElevatorEl,
  effectsTorchEl,
  debugScanlineInput,
  saveSettingsBtn,
  cancelSettingsBtn,
  testDingBtn,
  testFinalBtn,
  render,
  updateMuteButton,
  updateGlow,
  updateTheme,
  updateEmbers,
} from './dom.js';
import {
  startTimer,
  suspendTimer,
  toggleTimer,
  resetTimer,
  nudgeTimer,
  jumpToFinalCountdown,
  enterStandby,
  wakeFromStandby,
} from './timer.js';
import {
  MODE_ELEVATOR,
  MODE_TORCH,
  CONTROLS_HIDE_MS,
  LOWER_QUADRANT_RATIO,
  STAGE_TOUCH_ZONE_RATIO,
  NUDGE_BASE_SECONDS,
  NUDGE_MAX_SECONDS,
  NUDGE_ACCEL_WINDOW_MS,
  NUDGE_ACCEL_FACTOR,
  DURATION_STEP_REPEAT_DELAY_MS,
  DURATION_STEP_REPEAT_MS,
} from './constants.js';

/** @type {ReturnType<typeof setTimeout>|null} */
let hideControlsTimer = null;
/** @type {HTMLElement|null} */
let settingsTrigger = null; // element to return focus to when the dialog closes
// Set on pointerdown when the tap only reveals hidden controls, so the same
// tap doesn't also pause/nudge/wake via the stage click.
let revealingControls = false;
// Mode selection is pending (like duration) until Settings is saved.
let pendingMode = state.mode;

function showControls() {
  controlsEl.classList.add('visible');
  clearTimeout(hideControlsTimer ?? undefined);
  hideControlsTimer = setTimeout(
    () => controlsEl.classList.remove('visible'),
    CONTROLS_HIDE_MS,
  );
}

function isOverlayOpen() {
  return !overlay.classList.contains('hidden');
}

/** @param {KeyboardEvent} e */
function trapFocus(e) {
  const focusable =
    /** @type {NodeListOf<HTMLButtonElement|HTMLInputElement>} */ (
      overlay.querySelectorAll('button, input')
    );
  const list = Array.from(focusable).filter(
    (el) => !el.disabled && el.offsetParent !== null,
  );
  if (list.length === 0) return;
  const first = list[0];
  const last = list[list.length - 1];
  // The title (tabindex="-1") holds initial focus but isn't part of the
  // normal tab sequence, so Shift+Tab from it would otherwise walk past
  // the dialog entirely to whatever precedes it in the DOM.
  if (
    e.shiftKey &&
    (document.activeElement === first ||
      document.activeElement === settingsTitleEl)
  ) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Mode toggle in Settings previews that mode's remembered duration
 * immediately, but doesn't touch state until Save (same as duration).
 * @param {'elevator'|'torch'} mode
 */
function selectPendingMode(mode) {
  pendingMode = mode;
  const isTorch = mode === MODE_TORCH;
  modeElevatorBtn.classList.toggle('active', !isTorch);
  modeTorchBtn.classList.toggle('active', isTorch);
  modeElevatorBtn.setAttribute('aria-checked', String(!isTorch));
  modeTorchBtn.setAttribute('aria-checked', String(isTorch));
  const seconds = isTorch ? state.torchTotalSeconds : state.elevatorTotalSeconds;
  setMinutesInput.value = String(Math.floor(seconds / 60));
  setSecondsInput.value = String(seconds % 60);
  // Each theme offers its own effects — the LCD scanline sweep/glow don't
  // fit a grim unlit torch, which gets a drifting-embers effect instead.
  effectsElevatorEl.hidden = isTorch;
  effectsTorchEl.hidden = !isTorch;
  debugScanlineInput.disabled = isTorch;
}

/** @returns {number} total seconds, clamped to the field bounds (falls back to the active theme's default if zero) */
function readPendingDuration() {
  const minutes = Math.max(
    0,
    Math.min(99, parseInt(setMinutesInput.value, 10) || 0),
  );
  const seconds = Math.max(
    0,
    Math.min(59, parseInt(setSecondsInput.value, 10) || 0),
  );
  const total = minutes * 60 + seconds;
  if (total > 0) return total;
  const fallback = getTheme(pendingMode);
  return fallback.defaultMinutes * 60 + fallback.defaultSeconds;
}

function applyPendingSettings() {
  state.mode = pendingMode;
  const total = readPendingDuration();
  state.totalSeconds = total;
  if (pendingMode === MODE_TORCH) state.torchTotalSeconds = total;
  else state.elevatorTotalSeconds = total;
  state.soundEnabled = setSoundInput.checked;
  state.scanlineEnabled = setScanlineInput.checked;
  setScanlineEnabled(state.scanlineEnabled);
  state.glowEnabled = setGlowInput.checked;
  state.torchEmbersEnabled = setEmbersInput.checked;
  state.torchGlowEnabled = setFlameGlowInput.checked;
  updateGlow();
  updateEmbers();
  updateMuteButton();
  updateTheme();
  persistSettings();
}

function openSettings() {
  state.wasRunningBeforeSettings = suspendTimer();
  selectPendingMode(state.mode);
  setSoundInput.checked = state.soundEnabled;
  setScanlineInput.checked = state.scanlineEnabled;
  setGlowInput.checked = state.glowEnabled;
  setEmbersInput.checked = state.torchEmbersEnabled;
  setFlameGlowInput.checked = state.torchGlowEnabled;
  settingsTrigger =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  overlay.classList.remove('hidden');
  // Focus the dialog itself, not a text field — avoids popping the
  // on-screen keyboard just from opening Settings.
  settingsTitleEl.focus();
}

/** @param {{resume: boolean}} options */
function closeSettings({ resume }) {
  overlay.classList.add('hidden');
  render();
  if (resume && state.wasRunningBeforeSettings) startTimer();
  showControls();
  const returnTo =
    settingsTrigger && document.body.contains(settingsTrigger)
      ? settingsTrigger
      : settingsBtn;
  returnTo.focus();
  settingsTrigger = null;
}

function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

/**
 * A home-screen-launched iPad/iPhone PWA still shows the system status bar
 * (clock/wifi/battery) unless the page is ALSO put into true Fullscreen API
 * mode — Apple provides no "truly fullscreen" web-app display mode. Safari
 * only grants requestFullscreen() from within a real user gesture, never
 * automatically on load, so engage it transparently on the first tap/key
 * instead of requiring a dedicated button press.
 */
function bindAutoFullscreenForStandalone() {
  if (!document.fullscreenEnabled) return;
  const nav = /** @type {{standalone?: boolean}} */ (window.navigator);
  const standalone = nav.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches;
  if (!standalone) return;

  const engage = () => {
    document.removeEventListener('pointerdown', engage);
    document.removeEventListener('keydown', engage);
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  };
  document.addEventListener('pointerdown', engage, { once: true });
  document.addEventListener('keydown', engage, { once: true });
}

// Tapping near either edge of the stage nudges time (for quick table-top
// touch control); tapping the middle toggles play/pause. Any tap wakes
// the display out of standby instead, regardless of where it lands.
/** @param {MouseEvent} e */
function handleStageTap(e) {
  if (revealingControls) return;
  if (state.standby) {
    wakeFromStandby();
    return;
  }
  const xRatio = e.clientX / window.innerWidth;
  if (xRatio < STAGE_TOUCH_ZONE_RATIO) {
    nudge('down');
  } else if (xRatio > 1 - STAGE_TOUCH_ZONE_RATIO) {
    nudge('up');
  } else {
    toggleTimer();
  }
}

function bindStage() {
  stage.addEventListener('click', handleStageTap);
}

function bindControls() {
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetTimer();
  });

  standbyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    enterStandby();
  });

  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.soundEnabled = !state.soundEnabled;
    updateMuteButton();
    persistSettings();
  });

  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSettings();
  });

  fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFullscreen();
  });

  overlay.addEventListener('click', (e) => e.stopPropagation());

  modeElevatorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectPendingMode(MODE_ELEVATOR);
  });

  modeTorchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectPendingMode(MODE_TORCH);
  });

  saveSettingsBtn.addEventListener('click', () => {
    applyPendingSettings();
    resetTimer();
    closeSettings({ resume: false });
  });

  cancelSettingsBtn.addEventListener('click', () =>
    closeSettings({ resume: true }),
  );

  testDingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    getTheme(pendingMode).minuteTick();
  });

  testFinalBtn.addEventListener('click', () => {
    applyPendingSettings();
    overlay.classList.add('hidden');
    jumpToFinalCountdown();
    showControls();
  });

  debugScanlineInput.addEventListener('change', (e) => {
    e.stopPropagation();
    setScanlineContinuous(debugScanlineInput.checked);
  });
}

/**
 * @typedef {'up'|'down'} NudgeDirection
 */

// Shared ramp state: repeated nudges in the same direction within the
// acceleration window step up faster, like a held volume/stepper button.
// Both the arrow keys (OS key-repeat) and the on-screen hold buttons
// (interval below) drive this through the same function.
/** @type {{direction: NudgeDirection|null, step: number, lastTime: number}} */
const nudgeRamp = { direction: null, step: NUDGE_BASE_SECONDS, lastTime: 0 };

function resetNudgeRamp() {
  nudgeRamp.direction = null;
  nudgeRamp.step = NUDGE_BASE_SECONDS;
}

/** @param {NudgeDirection} direction */
function nudge(direction) {
  const now = Date.now();
  if (
    nudgeRamp.direction === direction &&
    now - nudgeRamp.lastTime <= NUDGE_ACCEL_WINDOW_MS
  ) {
    nudgeRamp.step = Math.min(
      NUDGE_MAX_SECONDS,
      nudgeRamp.step * NUDGE_ACCEL_FACTOR,
    );
  } else {
    nudgeRamp.step = NUDGE_BASE_SECONDS;
  }
  nudgeRamp.direction = direction;
  nudgeRamp.lastTime = now;
  nudgeTimer(direction === 'up' ? nudgeRamp.step : -nudgeRamp.step);
}

/**
 * @param {HTMLElement} button
 * @param {NudgeDirection} direction
 */
function bindHoldToNudge(button, direction) {
  /** @type {ReturnType<typeof setInterval>|null} */
  let repeatId = null;

  const stop = () => {
    clearInterval(repeatId ?? undefined);
    repeatId = null;
    resetNudgeRamp();
  };

  button.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    clearInterval(repeatId ?? undefined); // second finger on same button
    nudge(direction);
    repeatId = setInterval(() => nudge(direction), 90);
    document.addEventListener('pointerup', stop, { once: true });
    document.addEventListener('pointercancel', stop, { once: true });
  });
}

// Settings duration steppers: tap = ±1, holding repeats at a fixed rate
// (no acceleration — precise duration entry favors predictable steps).
/**
 * @param {HTMLInputElement} input
 * @param {number} delta
 * @param {number} min
 * @param {number} max
 */
function stepDurationInput(input, delta, min, max) {
  const next = Math.max(
    min,
    Math.min(max, (parseInt(input.value, 10) || 0) + delta),
  );
  input.value = String(next);
}

/**
 * @param {HTMLElement} button
 * @param {HTMLInputElement} input
 * @param {number} delta
 * @param {number} min
 * @param {number} max
 */
function bindDurationStepper(button, input, delta, min, max) {
  /** @type {ReturnType<typeof setInterval>|null} */
  let repeatId = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let startTimeout = null;

  const stop = () => {
    clearTimeout(startTimeout ?? undefined);
    clearInterval(repeatId ?? undefined);
    repeatId = null;
  };

  button.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    stop(); // second finger on same button
    stepDurationInput(input, delta, min, max);
    startTimeout = setTimeout(() => {
      repeatId = setInterval(
        () => stepDurationInput(input, delta, min, max),
        DURATION_STEP_REPEAT_MS,
      );
    }, DURATION_STEP_REPEAT_DELAY_MS);
    document.addEventListener('pointerup', stop, { once: true });
    document.addEventListener('pointercancel', stop, { once: true });
  });
}

// Controls stay hidden during normal play so they never flash on every
// pause/resume tap. They only surface via Escape or a tap/click in the
// bottom quadrant, where the bar itself lives.
function bindControlsVisibility() {
  document.addEventListener('pointerdown', (e) => {
    const inLowerQuadrant =
      e.clientY >= window.innerHeight * LOWER_QUADRANT_RATIO;
    revealingControls =
      inLowerQuadrant && !controlsEl.classList.contains('visible');
    if (inLowerQuadrant) showControls();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      isOverlayOpen() ? closeSettings({ resume: true }) : showControls();
      return;
    }
    if (isOverlayOpen()) {
      if (e.key === 'Tab') trapFocus(e);
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      state.standby ? wakeFromStandby() : toggleTimer();
    } else if (e.key === 'r' || e.key === 'R') {
      enterStandby();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nudge('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nudge('down');
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') resetNudgeRamp();
  });
}

export function initUI() {
  bindStage();
  bindControls();
  bindHoldToNudge(nudgeUpBtn, 'up');
  bindHoldToNudge(nudgeDownBtn, 'down');
  bindDurationStepper(minUpBtn, setMinutesInput, 1, 0, 99);
  bindDurationStepper(minDownBtn, setMinutesInput, -1, 0, 99);
  bindDurationStepper(secUpBtn, setSecondsInput, 1, 0, 59);
  bindDurationStepper(secDownBtn, setSecondsInput, -1, 0, 59);
  bindControlsVisibility();
  bindAutoFullscreenForStandalone();
  // iPhone Safari has no Fullscreen API for non-video elements.
  fullscreenBtn.hidden = !document.fullscreenEnabled;
  updateMuteButton();
  updateGlow();
  updateEmbers();
  updateTheme();
  render();
}
