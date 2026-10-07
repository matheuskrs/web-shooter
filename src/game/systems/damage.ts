import type { Ship, Team } from '../simulation/entities';
import type { DestroyCause } from '../simulation/events';
import type { World } from '../simulation/World';

export interface DamageSource {
  cause: DestroyCause;
  /** Team that dealt the damage; only player cannon kills score. */
  team: Team;
}

/**
 * The single place where health changes. A ship dies inside this call, so
 * any system running later in the same step already sees it as dead and can
 * no longer hit it, be hit, shoot or collide.
 */
export function damageShip(world: World, target: Ship, amount: number, source: DamageSource): void {
  if (!target.alive || world.phase !== 'running') return;

  target.health = Math.max(0, target.health - amount);
  world.emit({
    type: 'shipDamaged',
    shipId: target.id,
    team: target.team,
    health: target.health,
    maxHealth: target.config.maxHealth,
  });
  if (target.health > 0) return;

  destroyShip(world, target, source);
}

export function destroyShip(world: World, target: Ship, source: DamageSource): void {
  if (!target.alive) return;
  target.alive = false;
  target.speed = 0;
  world.emit({
    type: 'shipDestroyed',
    shipId: target.id,
    kind: target.kind,
    team: target.team,
    cause: source.cause,
    x: target.x,
    y: target.y,
    heading: target.heading,
  });

  if (target === world.player) {
    world.end('defeated');
    return;
  }
  if (source.cause === 'cannon' && source.team === 'player') {
    world.score += 1;
    world.emit({ type: 'scoreChanged', score: world.score });
  }
}
