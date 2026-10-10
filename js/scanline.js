import { state } from './state.js';
import {
  SCANLINE_SWEEP_MIN_MS,
  SCANLINE_SWEEP_MAX_MS,
  SCANLINE_SWEEP_DURATION_MS,
} from './constants.js';

/** @type {HTMLElement|null} */
let el = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let pendingTimer = null;

// Fires the CRT scan-beam sweep at an irregular interval
function scheduleNext() {
  if (!el) return;
  const target = el;
  const delay =
    SCANLINE_SWEEP_MIN_MS +
    Math.random() * (SCANLINE_SWEEP_MAX_MS - SCANLINE_SWEEP_MIN_MS);
  pendingTimer = setTimeout(() => {
    target.classList.add('active');
    setTimeout(
      () => target.classList.remove('active'),
      SCANLINE_SWEEP_DURATION_MS,
    );
    if (state.scanlineEnabled) scheduleNext();
  }, delay);
}

export function initScanlineSweep() {
  el = document.getElementById('scanlineSweep');
  if (!el) return;
  if (state.scanlineEnabled) scheduleNext();
}

/**
 * Settings toggle: turn the random sweep on/off at runtime.
 * @param {boolean} enabled
 */
export function setScanlineEnabled(enabled) {
  if (!el) return;
  if (enabled) {
    if (!pendingTimer) scheduleNext();
  } else {
    clearTimeout(pendingTimer ?? undefined);
    pendingTimer = null;
    el.classList.remove('active');
  }
}

/**
 * Debug helper
 * @param {boolean} enabled
 */
export function setScanlineContinuous(enabled) {
  if (!el) return;
  el.classList.toggle('continuous', enabled);
  if (enabled) {
    clearTimeout(pendingTimer ?? undefined);
    pendingTimer = null;
    el.classList.remove('active');
  } else if (state.scanlineEnabled) {
    scheduleNext();
  }
}
