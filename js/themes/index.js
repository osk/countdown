import { elevatorTheme } from './elevator.js';
import { torchTheme } from './torch.js';

/**
 * @typedef {Object} Theme
 * @property {string} id
 * @property {number} defaultMinutes
 * @property {number} defaultSeconds
 * @property {(secondsLeft: number) => void} finalTick
 * @property {() => void} minuteTick
 * @property {(ctx: {startTimer: () => void, enterStandby: () => void}) => void} runZeroSequence
 * @property {(onComplete: () => void) => void} runWakeSequence
 * @property {() => void} enterDarkness
 * @property {() => void} exitDarkness
 * @property {() => void} clearTransientClasses
 */

/** @type {Record<string, Theme>} */
const themes = {
  [elevatorTheme.id]: elevatorTheme,
  [torchTheme.id]: torchTheme,
};

/**
 * @param {string} mode
 * @returns {Theme}
 */
export function getTheme(mode) {
  return themes[mode] ?? elevatorTheme;
}

export { elevatorTheme, torchTheme };
