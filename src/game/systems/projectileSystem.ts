import { overlapsObstacle } from '../collision/geometry';
import type { Projectile, Ship } from '../simulation/entities';
import type { World } from '../simulation/World';
import { damageShip } from './damage';
import { hullCircleX, hullCircleY } from './hull';

/**
 * Projectiles are tested at their new position each step without sweeping.
 * The fastest ball moves 12px per 1/60s step while the smallest target
 * reach is ~27px, so a ball cannot tunnel through a hull or an island edge.
 */
export function updateProjectiles(world: World, dt: number): void {
  const { width, height } = world.config.arena;
  for (const projectile of world.projectiles) {
    projectile.prevX = projectile.x;
    projectile.prevY = projectile.y;
    if (!projectile.alive) continue;
    if (world.phase !== 'running') return;

    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.remainingDistance -= Math.hypot(projectile.vx, projectile.vy) * dt;

    if (hitShip(world, projectile)) continue;

    if (hitsObstacle(world, projectile)) {
      projectile.alive = false;
      world.emit({ type: 'projectileHitObstacle', x: projectile.x, y: projectile.y });
      continue;
    }
    if (projectile.x < 0 || projectile.y < 0 || projectile.x > width || projectile.y > height) {
      projectile.alive = false;
      continue;
    }
    if (projectile.remainingDistance <= 0) {
      projectile.alive = false;
      world.emit({ type: 'projectileSplash', x: projectile.x, y: projectile.y });
    }
  }
}

function hitsObstacle(world: World, projectile: Projectile): boolean {
  for (const obstacle of world.obstacles) {
    if (overlapsObstacle(projectile.x, projectile.y, projectile.radius, obstacle)) return true;
  }
  return false;
}

/** Applies damage to the first ship touched and retires the projectile, so it can hit at most once. */
function hitShip(world: World, projectile: Projectile): boolean {
  for (const ship of world.ships) {
    if (!ship.alive || ship.team === projectile.team) continue;
    if (!touches(ship, projectile)) continue;
    projectile.alive = false;
    world.emit({
      type: 'shipHit',
      shipId: ship.id,
      team: ship.team,
      x: projectile.x,
      y: projectile.y,
      damage: projectile.damage,
    });
    damageShip(world, ship, projectile.damage, { cause: 'cannon', team: projectile.team });
    return true;
  }
  return false;
}

function touches(ship: Ship, projectile: Projectile): boolean {
  const hull = ship.config.hull;
  const reach = hull.radius + hull.hitRadiusBonus + projectile.radius;
  for (let i = 0; i < hull.circleOffsets.length; i++) {
    const dx = projectile.x - hullCircleX(ship, i);
    const dy = projectile.y - hullCircleY(ship, i);
    if (dx * dx + dy * dy < reach * reach) return true;
  }
  return false;
}
