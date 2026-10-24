import { state } from './state.js';
import {
  SCANLINE_SWEEP_MIN_MS,
  SCANLINE_SWEEP_MAX_MS,
  SCANLINE_SWEEP_DURATION_MS,
  MODE_TORCH,
} from './constants.js';

/** @type {HTMLElement|null} */
let el = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let pendingTimer = null;

// Shadowdark torch theme keeps this CRT artifact off entirely — it doesn't
// fit a grim, unlit torch.
function scanlineAllowed() {
  return state.scanlineEnabled && state.mode !== MODE_TORCH;
}

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
    if (scanlineAllowed()) scheduleNext();
  }, delay);
}

export function initScanlineSweep() {
  el = document.getElementById('scanlineSweep');
  if (!el) return;
  if (scanlineAllowed()) scheduleNext();
}

/**
 * Settings toggle: turn the random sweep on/off at runtime.
 * @param {boolean} enabled
 */
export function setScanlineEnabled(enabled) {
  if (!el) return;
  if (enabled && state.mode !== MODE_TORCH) {
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
  if (state.mode === MODE_TORCH) {
    el.classList.remove('continuous', 'active');
    return;
  }
  el.classList.toggle('continuous', enabled);
  if (enabled) {
    clearTimeout(pendingTimer ?? undefined);
    pendingTimer = null;
    el.classList.remove('active');
  } else if (scanlineAllowed()) {
    scheduleNext();
  }
}
