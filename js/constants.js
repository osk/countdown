export const STORAGE_KEY = 'lcd-fullscreen-countdown-settings';
export const DEFAULT_MINUTES = 10;
export const DEFAULT_SECONDS = 0;

// When we change to "dramatic" countdown
export const URGENT_AT_SECS_REMAINING = 5;
export const CRITICAL_AT_SECS_REMAINING = 3;

// Delay after we hit zero and play alarm.
export const ZERO_ALARM_MS = 1800;

// One second of total silence on "00:00" after the alarm finishes, so its
// tail doesn't clash into the elevator-open chime.
export const ALARM_SILENCE_MS = 1000;

// Delay after we reset timer until we play door chime
export const DOOR_SOUND_DELAY_MS = 1000;

// Delay after we play door chime before countdown starts again
export const FINAL_BREATHER_MS = 5000;

export const CONTROLS_HIDE_MS = 3500;
// Ratio of viewport height we show controls on
export const LOWER_QUADRANT_RATIO = 0.75;

// When nudging timer up and down
export const NUDGE_BASE_SECONDS = 5;
export const NUDGE_MAX_SECONDS = 60;
export const NUDGE_ACCEL_WINDOW_MS = 400;
export const NUDGE_ACCEL_FACTOR = 1.6;

// Ratio where we nudge instead of play/pause
export const STAGE_TOUCH_ZONE_RATIO = 0.28;

// Length of wakeup animation.
// Must match the `crtPowerOn` keyframes duration in styles/effects.css.
export const STANDBY_WAKE_MS = 700;

// Settings duration steppers
export const DURATION_STEP_REPEAT_DELAY_MS = 350;
export const DURATION_STEP_REPEAT_MS = 150;

// Random CRT scanning beam
export const SCANLINE_SWEEP_MIN_MS = 6000;
export const SCANLINE_SWEEP_MAX_MS = 20000;
export const SCANLINE_SWEEP_DURATION_MS = 1100;
