import { approach, clamp, lerp, wrapAngle } from '../math/scalar';
import type { World } from '../simulation/World';

/**
 * Arcade boat handling: velocity always points along the heading (no drift),
 * speed ramps quickly towards the throttle target and turning works even
 * from a standstill. Predictable steering matters more than realism here.
 */
export function updateMovement(world: World, dt: number): void {
  for (const ship of world.ships) {
    ship.prevX = ship.x;
    ship.prevY = ship.y;
    ship.prevHeading = ship.heading;
    if (!ship.alive) continue;

    const movement = ship.config.movement;
    const targetSpeed = clamp(ship.controls.throttle, 0, 1) * movement.maxSpeed;
    const rate = targetSpeed > ship.speed ? movement.acceleration : movement.deceleration;
    ship.speed = approach(ship.speed, targetSpeed, rate * dt);

    const speedFactor = clamp(ship.speed / movement.maxSpeed, 0, 1);
    const turnRate = movement.turnRate * lerp(movement.stationaryTurnFactor, 1, speedFactor);
    ship.heading = wrapAngle(ship.heading + clamp(ship.controls.turn, -1, 1) * turnRate * dt);

    ship.x += Math.cos(ship.heading) * ship.speed * dt;
    ship.y += Math.sin(ship.heading) * ship.speed * dt;
  }
}
