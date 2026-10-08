import { overlapsObstacle } from '../collision/geometry';
import { angleDelta, clamp } from '../math/scalar';
import type { Ship } from '../simulation/entities';
import type { World } from '../simulation/World';

/** Converts heading error (rad) into a turn command; ~0.5 rad error saturates the rudder. */
const STEERING_GAIN = 2;
const WHISKER_ANGLE = 0.65;
const AVOID_COMMIT_SECONDS = 0.7;
const AVOID_TURN = 1.3;
const STUCK_SECONDS = 0.8;
const LOS_STEP = 28;

export function updateEnemyAi(world: World, dt: number): void {
  const player = world.player;
  for (const ship of world.ships) {
    if (!ship.alive || ship.team !== 'enemy') continue;
    if (!player?.alive) {
      ship.controls.throttle = 0;
      ship.controls.turn = 0;
      ship.controls.fire.front = false;
      continue;
    }
    if (ship.kind === 'chaser') steerChaser(ship, player);
    else steerShooter(world, ship, player);
    applyObstacleAvoidance(world, ship, dt);
  }
}

/** Chasers ram: full sail at the target, aiming slightly ahead of where it is going. */
export function steerChaser(ship: Ship, player: Ship): void {
  const distance = Math.hypot(player.x - ship.x, player.y - ship.y);
  const lead = Math.min(0.6, distance / Math.max(ship.config.movement.maxSpeed, 1)) * 0.5;
  const targetX = player.x + Math.cos(player.heading) * player.speed * lead;
  const targetY = player.y + Math.sin(player.heading) * player.speed * lead;
  const error = angleDelta(ship.heading, Math.atan2(targetY - ship.y, targetX - ship.x));
  ship.controls.turn = clamp(error * STEERING_GAIN, -1, 1);
  // Ease off only when facing away, so the turn radius stays tight enough to come around.
  ship.controls.throttle = Math.abs(error) > 1.6 ? 0.55 : 1;
  ship.controls.fire.front = false;
}

/**
 * Shooters keep their distance: close in until within range, then hold
 * position and pivot to aim, and back off when the player gets too close.
 */
export function steerShooter(world: World, ship: Ship, player: Ship): void {
  const behaviour = world.config.shooter.behaviour;
  const dx = player.x - ship.x;
  const dy = player.y - ship.y;
  const distance = Math.hypot(dx, dy);
  const towardPlayer = Math.atan2(dy, dx);
  const aimError = angleDelta(ship.heading, towardPlayer);

  let desired = towardPlayer;
  if (distance > behaviour.attackRange * 0.9) {
    ship.controls.throttle = 1;
  } else if (distance < behaviour.minRange) {
    desired = towardPlayer + Math.PI;
    ship.controls.throttle = 1;
  } else {
    ship.controls.throttle = distance > behaviour.preferredRange ? 0.3 : 0;
  }
  ship.controls.turn = clamp(angleDelta(ship.heading, desired) * STEERING_GAIN, -1, 1);

  ship.controls.fire.front =
    distance <= behaviour.attackRange &&
    Math.abs(aimError) <= behaviour.aimTolerance &&
    hasLineOfSight(world, ship.x, ship.y, player.x, player.y);
}

export function hasLineOfSight(world: World, ax: number, ay: number, bx: number, by: number): boolean {
  const length = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(length / LOS_STEP);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const obstacle of world.obstacles) {
      if (overlapsObstacle(x, y, 4, obstacle)) return false;
    }
  }
  return true;
}

function isBlocked(world: World, x: number, y: number, radius: number): boolean {
  const { width, height } = world.config.arena;
  if (x < radius || y < radius || x > width - radius || y > height - radius) return true;
  for (const obstacle of world.obstacles) {
    if (overlapsObstacle(x, y, radius, obstacle)) return true;
  }
  return false;
}

function probe(world: World, ship: Ship, angle: number, distance: number, radius: number): boolean {
  return isBlocked(world, ship.x + Math.cos(angle) * distance, ship.y + Math.sin(angle) * distance, radius);
}

/**
 * Whisker steering: probe ahead and at two angles; when the bow is about to
 * meet an obstacle, commit to turning towards the freer side for a short
 * time so the ship does not flip-flop between left and right.
 */
export function applyObstacleAvoidance(world: World, ship: Ship, dt: number): void {
  const brain = ship.brain;
  const hull = ship.config.hull;
  const lookAhead = 70 + ship.speed * 0.7;
  const radius = hull.radius + 6;

  brain.avoidTimer = Math.max(0, brain.avoidTimer - dt);
  trackStuck(ship, dt);

  const blockedAhead =
    probe(world, ship, ship.heading, lookAhead, radius) || probe(world, ship, ship.heading, lookAhead * 0.5, radius);

  if (blockedAhead && brain.avoidTimer <= 0) {
    const leftBlocked = probe(world, ship, ship.heading - WHISKER_ANGLE, lookAhead, radius);
    const rightBlocked = probe(world, ship, ship.heading + WHISKER_ANGLE, lookAhead, radius);
    if (leftBlocked !== rightBlocked) brain.avoidSide = leftBlocked ? 1 : -1;
    else brain.avoidSide = ship.controls.turn < 0 ? -1 : 1;
    brain.avoidTimer = AVOID_COMMIT_SECONDS;
  }

  if (brain.stuckTimer > STUCK_SECONDS) {
    brain.avoidSide = brain.avoidSide === 0 ? 1 : -brain.avoidSide;
    brain.avoidTimer = AVOID_COMMIT_SECONDS * 1.5;
    brain.stuckTimer = 0;
  }

  if (brain.avoidTimer > 0) {
    ship.controls.turn = clamp(brain.avoidSide * AVOID_TURN, -1, 1);
    ship.controls.throttle = Math.max(ship.controls.throttle, 0.6);
  } else {
    brain.avoidSide = 0;
  }
}

/** A ship pushing its throttle but barely moving is grinding against something. */
function trackStuck(ship: Ship, dt: number): void {
  const moved = Math.hypot(ship.x - ship.prevX, ship.y - ship.prevY);
  const expected = ship.config.movement.maxSpeed * ship.controls.throttle * dt;
  if (expected > 0.5 && moved < expected * 0.25) ship.brain.stuckTimer += dt;
  else ship.brain.stuckTimer = Math.max(0, ship.brain.stuckTimer - dt);
}
