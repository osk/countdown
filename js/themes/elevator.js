import { state } from '../state.js';
import { render, stage, displayEl } from '../dom.js';
import { primeAudio, minuteTick, urgentTick, zeroAlarm, elevatorArrival } from '../audio.js';
import {
  MODE_ELEVATOR,
  DEFAULT_MINUTES,
  DEFAULT_SECONDS,
  ZERO_ALARM_MS,
  ALARM_SILENCE_MS,
  DOOR_SOUND_DELAY_MS,
  FINAL_BREATHER_MS,
  STANDBY_WAKE_MS,
} from '../constants.js';

/**
 * Elevator theme — the original LCD floor-indicator countdown. Zero means
 * "doors open": flash, alarm, a beat on 00:00, the arrival chime, then it
 * restarts itself with no input required. See styles/themes/elevator.css
 * for the matching visuals.
 */
export const elevatorTheme = {
  id: MODE_ELEVATOR,
  defaultMinutes: DEFAULT_MINUTES,
  defaultSeconds: DEFAULT_SECONDS,

  finalTick: urgentTick,
  minuteTick,

  /**
   * Owns the whole zero-moment choreography, including restarting the
   * countdown itself once it's done.
   * @param {{startTimer: () => void}} ctx
   */
  runZeroSequence({ startTimer }) {
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
  },

  /**
   * Breaking out of standby: arrival chime, then the CRT power-on fade-in,
   * then hand back to the caller once it has fully resolved.
   * @param {() => void} onComplete
   */
  runWakeSequence(onComplete) {
    displayEl.classList.add('waking');
    // primeAudio() must be *called* synchronously within the triggering
    // gesture, but a context constructed this same tick can still be
    // 'suspended' — wait for it to actually resume before scheduling the
    // chime, or the first tone can get silently swallowed.
    primeAudio().then(() => elevatorArrival());
    state.wakeTimeout = setTimeout(() => {
      state.wakeTimeout = null;
      displayEl.classList.remove('waking');
      onComplete();
    }, STANDBY_WAKE_MS);
  },

  enterDarkness() {},
  exitDarkness() {},

  clearTransientClasses() {
    stage.classList.remove('flash-active');
    displayEl.classList.remove('waking');
  },
};
