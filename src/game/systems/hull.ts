import type { Ship } from '../simulation/entities';

/** World position of the i-th keel collider circle. */
export function hullCircleX(ship: Ship, index: number): number {
  return ship.x + Math.cos(ship.heading) * (ship.config.hull.circleOffsets[index] ?? 0);
}

export function hullCircleY(ship: Ship, index: number): number {
  return ship.y + Math.sin(ship.heading) * (ship.config.hull.circleOffsets[index] ?? 0);
}
