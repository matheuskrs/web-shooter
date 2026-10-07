import type { ShipConfig, ShipKind, WeaponConfig } from '../config/gameConfig';

export type Team = 'player' | 'enemy';
export type WeaponSlot = 'front' | 'left' | 'right';

/** What a ship wants to do this step. Written by player input or AI, read by movement/weapons. */
export interface ShipControls {
  /** 0..1 */
  throttle: number;
  /** -1 (left) .. 1 (right) */
  turn: number;
  fire: Record<WeaponSlot, boolean>;
}

export interface EnemyBrain {
  /** -1/1 while committed to steering around an obstacle, 0 otherwise. */
  avoidSide: number;
  avoidTimer: number;
  stuckTimer: number;
}

export interface Ship {
  readonly id: number;
  readonly kind: ShipKind;
  readonly team: Team;
  readonly config: ShipConfig;
  readonly weapons: Partial<Record<WeaponSlot, WeaponConfig>>;
  x: number;
  y: number;
  /** Radians; 0 faces +x, positive turns clockwise (screen space, y down). */
  heading: number;
  speed: number;
  /** Pose at the start of the current step, used for render interpolation. */
  prevX: number;
  prevY: number;
  prevHeading: number;
  health: number;
  alive: boolean;
  controls: ShipControls;
  cooldowns: Record<WeaponSlot, number>;
  brain: EnemyBrain;
}

export interface Projectile {
  readonly id: number;
  readonly team: Team;
  readonly ownerId: number;
  readonly slot: WeaponSlot;
  readonly damage: number;
  readonly radius: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  readonly vx: number;
  readonly vy: number;
  remainingDistance: number;
  alive: boolean;
}

export function createControls(): ShipControls {
  return { throttle: 0, turn: 0, fire: { front: false, left: false, right: false } };
}
