import { readTestOverrides } from '../testing/testApi';

/**
 * - full: camera travel, motion blur and idle drift
 * - reduced: `prefers-reduced-motion`; the camera cuts instead of travelling
 * - instant: automated tests (`?clock=manual`); cuts, and the background world is frozen
 */
export type MotionMode = 'full' | 'reduced' | 'instant';

const manualClock = readTestOverrides().manualClock;

export function motionMode(): MotionMode {
  if (manualClock) return 'instant';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  return 'full';
}

/** Camera timings. Menu panels are anchored in the world, so they move with these. */
export const CAMERA_TIMING = {
  /** Menu screen to menu screen. */
  travelMs: 850,
  /** PLAY: across the world to the player's ship, then the settle into battle framing. */
  playTravelMs: 900,
  playSettleMs: 450,
  /** Play Again / Restart: a short hop within the arena. */
  replayTravelMs: 450,
} as const;

export function cameraDuration(ms: number, mode: MotionMode = motionMode()): number {
  return mode === 'full' ? ms : 0;
}
