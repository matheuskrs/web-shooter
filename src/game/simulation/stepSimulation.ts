import type { InputState } from '../input/InputState';
import { updateEnemyAi } from '../systems/enemyAiSystem';
import { updateMovement } from '../systems/movementSystem';
import { applyPlayerInput, type FireBuffer } from '../systems/playerControlSystem';
import { updateProjectiles } from '../systems/projectileSystem';
import { resolveShipCollisions } from '../systems/shipCollisionSystem';
import { updateSpawner } from '../systems/spawnSystem';
import { updateWeapons } from '../systems/weaponSystem';
import type { World } from './World';

/**
 * Advances the match by exactly one fixed step. The order is deliberate:
 *
 * 1. intents   – player input and enemy AI decide throttle/turn/fire
 * 2. movement  – integrate speed, heading and position
 * 3. contacts  – chaser rams, ship separation, islands and arena edges
 * 4. weapons   – cooldowns tick, new projectiles leave the muzzles
 * 5. projectiles – move, hit at most one ship or obstacle, expire
 * 6. spawner   – new enemies appear on safe points
 * 7. clock     – time up ends the match
 * 8. cleanup   – destroyed entities leave the world
 *
 * Deaths happen inside the damage call (steps 3 and 5), so anything later
 * in the same step already ignores the destroyed ship.
 */
export function stepSimulation(world: World, input: InputState, fireBuffer: FireBuffer, dt: number): void {
  if (world.phase !== 'running') return;
  world.steps++;

  applyPlayerInput(world, input, fireBuffer, dt);
  updateEnemyAi(world, dt);
  updateMovement(world, dt);
  resolveShipCollisions(world, dt);
  updateWeapons(world, dt);
  updateProjectiles(world, dt);
  updateSpawner(world, dt);

  if (world.phase === 'running') {
    world.elapsed += dt;
    if (world.elapsed >= world.config.sessionSeconds - 1e-9) {
      world.elapsed = world.config.sessionSeconds;
      world.end('time_up');
    }
  }

  world.removeDead();
  input.endStep();
}
