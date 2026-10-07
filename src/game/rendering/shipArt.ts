import type { ShipKind } from '../config/gameConfig';

export interface ShipArt {
  /** Atlas frames for health stages: intact, damaged, critical, wreck. */
  stages: readonly [string, string, string, string];
  scale: number;
  /** Local (unscaled sprite space) points where flames burn at low health. */
  flamePoints: readonly { x: number; y: number }[];
  /** Distance from the centre to the stern, where the wake starts. */
  sternOffset: number;
}

/**
 * Readability comes from the official ships themselves: the player sails the
 * red cross, shooters the yellow full-sized ship and chasers the smaller black
 * skull ship. Colours also differ in luminance, so they stay distinguishable
 * for red/green colour blindness.
 */
export const SHIP_ART: Readonly<Record<ShipKind, ShipArt>> = {
  player: {
    stages: ['ship_3', 'ship_9', 'ship_15', 'ship_21'],
    scale: 1,
    flamePoints: [
      { x: 9, y: 22 },
      { x: -11, y: -14 },
    ],
    sternOffset: 50,
  },
  shooter: {
    stages: ['ship_6', 'ship_12', 'ship_18', 'ship_24'],
    scale: 1,
    flamePoints: [
      { x: -9, y: 20 },
      { x: 10, y: -12 },
    ],
    sternOffset: 50,
  },
  chaser: {
    stages: ['ship_2', 'ship_8', 'ship_14', 'ship_20'],
    scale: 0.84,
    flamePoints: [
      { x: 8, y: 18 },
      { x: -10, y: -12 },
    ],
    sternOffset: 50,
  },
};

/** 0 intact, 1 damaged, 2 critical. Wreck (3) is only used after death. */
export function damageStage(health: number, maxHealth: number): 0 | 1 | 2 {
  const ratio = health / maxHealth;
  if (ratio > 2 / 3) return 0;
  if (ratio > 1 / 3) return 1;
  return 2;
}
