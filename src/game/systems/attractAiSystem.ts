import { angleDelta, clamp } from '../math/scalar';
import type { Ship } from '../simulation/entities';
import type { World } from '../simulation/World';
import { applyObstacleAvoidance, hasLineOfSight, steerChaser, steerShooter } from './enemyAiSystem';

/** Targets farther than this are ignored; ships head back towards the camera instead. */
const ENGAGE_RANGE = 950;
const BROADSIDE_RANGE = 380;
const BROADSIDE_TOLERANCE = 0.3;
const BOW_TOLERANCE = 0.12;

/**
 * Menu "attract mode" helmsman. Two fleets (red galleons vs. pirates) fight
 * each other with the real movement, weapons and damage systems. Chasers and
 * shooters reuse the match AI unchanged, just aimed at the nearest enemy hull
 * instead of the player. Idle ships drift back towards `focus` — the point
 * the camera is looking at — so the fighting stays on screen.
 */
export function updateAttractAi(world: World, focus: { x: number; y: number }, dt: number): void {
  for (const ship of world.ships) {
    if (!ship.alive) continue;
    ship.controls.fire.front = ship.controls.fire.left = ship.controls.fire.right = false;
    const target = nearestOpponent(world, ship);
    if (!target) {
      cruiseTowards(ship, focus);
    } else if (ship.kind === 'chaser') {
      steerChaser(ship, target);
    } else if (ship.kind === 'shooter') {
      steerShooter(world, ship, target);
    } else {
      steerBroadsider(world, ship, target);
    }
    applyObstacleAvoidance(world, ship, dt);
  }
}

function nearestOpponent(world: World, ship: Ship): Ship | null {
  let best: Ship | null = null;
  let bestDistance = ENGAGE_RANGE;
  for (const other of world.ships) {
    if (!other.alive || other.team === ship.team) continue;
    const distance = Math.hypot(other.x - ship.x, other.y - ship.y);
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

/** No one to fight: sail a slow lazy circle around the camera's focus. */
function cruiseTowards(ship: Ship, focus: { x: number; y: number }): void {
  const distance = Math.hypot(focus.x - ship.x, focus.y - ship.y);
  const towardFocus = Math.atan2(focus.y - ship.y, focus.x - ship.x);
  const desired = distance > 350 ? towardFocus : towardFocus + Math.PI / 2;
  ship.controls.turn = clamp(angleDelta(ship.heading, desired) * 1.5, -1, 1);
  ship.controls.throttle = 0.6;
}

/**
 * Galleons close in, then turn their side to the target and fire the
 * broadside — the attack that looks best from above.
 */
function steerBroadsider(world: World, ship: Ship, target: Ship): void {
  const dx = target.x - ship.x;
  const dy = target.y - ship.y;
  const distance = Math.hypot(dx, dy);
  const bearing = Math.atan2(dy, dx);
  const relative = angleDelta(ship.heading, bearing);

  if (distance > BROADSIDE_RANGE) {
    ship.controls.turn = clamp(relative * 2, -1, 1);
    ship.controls.throttle = 1;
  } else {
    // Put the target abeam on whichever side is already closer.
    const abeam = relative < 0 ? bearing + Math.PI / 2 : bearing - Math.PI / 2;
    ship.controls.turn = clamp(angleDelta(ship.heading, abeam) * 2, -1, 1);
    ship.controls.throttle = 0.55;
  }

  const clear = hasLineOfSight(world, ship.x, ship.y, target.x, target.y);
  if (!clear) return;
  ship.controls.fire.left = distance < BROADSIDE_RANGE + 60 && Math.abs(angleDelta(relative, -Math.PI / 2)) < BROADSIDE_TOLERANCE;
  ship.controls.fire.right = distance < BROADSIDE_RANGE + 60 && Math.abs(angleDelta(relative, Math.PI / 2)) < BROADSIDE_TOLERANCE;
  ship.controls.fire.front = distance < 600 && Math.abs(relative) < BOW_TOLERANCE;
}
