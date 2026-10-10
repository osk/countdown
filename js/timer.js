import { state } from './state.js';
import { render, stage, displayEl } from './dom.js';
import {
  primeAudio,
  minuteTick,
  urgentTick,
  zeroAlarm,
  elevatorArrival,
} from './audio.js';
import {
  URGENT_AT_SECS_REMAINING,
  ZERO_ALARM_MS,
  ALARM_SILENCE_MS,
  DOOR_SOUND_DELAY_MS,
  FINAL_BREATHER_MS,
  STANDBY_WAKE_MS,
} from './constants.js';
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
    if (secondsLeft > 0 && secondsLeft <= URGENT_AT_SECS_REMAINING) {
      urgentTick(secondsLeft);
    } else if (
      secondsLeft > 0 &&
      secondsLeft % 60 === 0 &&
      secondsLeft !== state.totalSeconds
    ) {
      minuteTick();
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
  displayEl.classList.remove('waking');
  stage.classList.remove('urgent', 'critical', 'flash-active');
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
 * instant reset. Only Space (wakeFromStandby) breaks out of it.
 */
export function enterStandby() {
  haltTimer();
  state.remainingMs = state.totalSeconds * 1000;
  state.standby = true;
  render();
  stage.classList.add('standby');
}

/**
 * Break out of standby: play the arrival chime, run the CRT power-on
 * fade-in on the display, then start the countdown once it has fully
 * resolved so the timer doesn't visibly start while still mid-fade.
 */
export function wakeFromStandby() {
  if (!state.standby) return;
  state.standby = false;
  stage.classList.remove('standby');
  displayEl.classList.add('waking');
  // primeAudio() must be *called* synchronously within the triggering
  // gesture, but a context constructed this same tick can still be
  // 'suspended' — wait for it to actually resume before scheduling the
  // chime, or the first tone can get silently swallowed.
  primeAudio().then(() => elevatorArrival());
  state.wakeTimeout = setTimeout(() => {
    state.wakeTimeout = null;
    displayEl.classList.remove('waking');
    startTimer();
  }, STANDBY_WAKE_MS);
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

  // Reach zero, flash and sound alarm
  stage.classList.add('flash-active');
  zeroAlarm();

  state.zeroTimeout = setTimeout(() => {
    stage.classList.remove('flash-active');

    // Delay after we hit zero
    state.zeroTimeout = setTimeout(() => {
      // Reset the display to the configured duration first...
      state.remainingMs = state.totalSeconds * 1000;
      state.lastWholeSecond = null;
      render();

      // ...then, after a beat of seeing the timer the door opens again
      state.zeroTimeout = setTimeout(() => {
        elevatorArrival();

        // Final breather before starting again
        state.zeroTimeout = setTimeout(() => {
          state.locked = false;
          startTimer();
        }, FINAL_BREATHER_MS);
      }, DOOR_SOUND_DELAY_MS);
    }, ALARM_SILENCE_MS);
  }, ZERO_ALARM_MS);
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
