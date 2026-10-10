// Keeps the screen awake while the page is visible.

/** @type {WakeLockSentinel|null} */
let sentinel = null;
let pending = false;

export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  if (sentinel || pending || document.visibilityState !== 'visible') return;
  pending = true;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // noop
  } finally {
    pending = false;
  }
}

export function initWakeLock() {
  requestWakeLock();
  document.addEventListener('visibilitychange', requestWakeLock);
}
