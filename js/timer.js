import { state } from './state.js';
import { render, stage } from './dom.js';
import { primeAudio } from './audio.js';
import { getTheme } from './themes/index.js';
import { URGENT_AT_SECS_REMAINING } from './constants.js';
import { requestWakeLock } from './wakeLock.js';

function frame() {
  if (!state.running) return;
  state.remainingMs = Math.max(
    0,
    (state.endTimestamp ?? Date.now()) - Date.now(),
  );
  const secondsLeft = Math.ceil(state.remainingMs / 1000);

  if (secondsLeft !== state.lastWholeSecond) {
    state.lastWholeSecond = secondsLeft;
    render();
    const theme = getTheme(state.mode);
    if (secondsLeft > 0 && secondsLeft <= URGENT_AT_SECS_REMAINING) {
      theme.finalTick(secondsLeft);
    } else if (
      secondsLeft > 0 &&
      secondsLeft % 60 === 0 &&
      secondsLeft !== state.totalSeconds
    ) {
      theme.minuteTick();
    }
  }

  if (state.remainingMs <= 0) {
    onZero();
    return;
  }
  state.rafId = requestAnimationFrame(frame);
}

export function startTimer() {
  if (state.running || state.locked) return;
  primeAudio(); // must happen synchronously within the triggering user gesture
  requestWakeLock();
  state.running = true;
  state.endTimestamp = Date.now() + state.remainingMs;
  state.lastWholeSecond = Math.ceil(state.remainingMs / 1000);
  render();
  state.rafId = requestAnimationFrame(frame);
}

export function pauseTimer() {
  if (!state.running) return;
  state.running = false;
  state.remainingMs = Math.max(
    0,
    (state.endTimestamp ?? Date.now()) - Date.now(),
  );
  cancelAnimationFrame(state.rafId ?? 0);
  render();
}

export function toggleTimer() {
  if (state.locked || state.standby || state.wakeTimeout) return;
  state.running ? pauseTimer() : startTimer();
}

// Stop countdown and cancel pending auto-starts
function haltTimer() {
  cancelAnimationFrame(state.rafId ?? 0);
  clearTimeout(state.zeroTimeout ?? undefined);
  clearTimeout(state.wakeTimeout ?? undefined);
  state.zeroTimeout = null;
  state.wakeTimeout = null;
  state.running = false;
  state.locked = false;
  state.lastWholeSecond = null;
  stage.classList.remove('urgent', 'critical');
  const theme = getTheme(state.mode);
  theme.exitDarkness();
  theme.clearTransientClasses();
}

export function resetTimer() {
  haltTimer();
  state.remainingMs = state.totalSeconds * 1000;
  render();
}

/**
 * Pause for Settings.
 * @returns {boolean} whether the countdown was running or about to start
 */
export function suspendTimer() {
  if (state.locked || state.wakeTimeout) {
    resetTimer();
    return true;
  }
  const wasRunning = state.running;
  pauseTimer();
  return wasRunning;
}

/**
 * Reset to the configured duration and black the screen out entirely,
 * armed and waiting — a deliberate "powered down" state rather than the
 * instant reset. Only a tap/Space (wakeFromStandby) breaks out of it.
 */
export function enterStandby() {
  haltTimer();
  state.remainingMs = state.totalSeconds * 1000;
  state.standby = true;
  render();
  stage.classList.add('standby');
  getTheme(state.mode).enterDarkness();
}

/**
 * Break out of standby: each theme owns its own relight choreography
 * (sound + visual class), then starts the countdown once it has fully
 * resolved so it doesn't visibly start while still mid-animation.
 */
export function wakeFromStandby() {
  if (!state.standby) return;
  state.standby = false;
  stage.classList.remove('standby');
  const theme = getTheme(state.mode);
  theme.exitDarkness();
  theme.runWakeSequence(() => startTimer());
}

/**
 * Scrub the live countdown forward (positive) or backward (negative).
 * Mutates `endTimestamp` while running so the drift-free frame loop picks
 * it up on its very next tick; mutates `remainingMs` directly while paused.
 * Does not touch `totalSeconds`, so Reset still returns to the configured
 * duration, not wherever the scrub landed.
 * @param {number} deltaSeconds
 */
export function nudgeTimer(deltaSeconds) {
  if (state.locked || state.standby) return;
  const deltaMs = deltaSeconds * 1000;
  // never scrub past the configured duration
  const maxMs = state.totalSeconds * 1000;

  if (state.running) {
    const now = Date.now();
    const end = state.endTimestamp ?? now;
    state.endTimestamp = Math.min(Math.max(end + deltaMs, now), now + maxMs);
    state.remainingMs = state.endTimestamp - now;
  } else {
    state.remainingMs = Math.min(
      maxMs,
      Math.max(0, state.remainingMs + deltaMs),
    );
  }
  // Pre-sync so the next frame() tick doesn't treat the jump as a natural
  // second boundary and fire a spurious tick/beep.
  state.lastWholeSecond = Math.ceil(state.remainingMs / 1000);
  render();
}

function onZero() {
  cancelAnimationFrame(state.rafId ?? 0);
  state.running = false;
  state.locked = true;
  state.remainingMs = 0;
  stage.classList.remove('urgent', 'critical');
  render();

  getTheme(state.mode).runZeroSequence({ startTimer, enterStandby });
}

/**
 * Settings "test mode" helper, jump straight into the final-countdown
 */
export function jumpToFinalCountdown() {
  haltTimer();
  state.standby = false;
  stage.classList.remove('standby');
  state.remainingMs =
    Math.min(state.totalSeconds, URGENT_AT_SECS_REMAINING) * 1000;
  render();
  startTimer();
}
