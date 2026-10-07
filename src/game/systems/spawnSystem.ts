import { overlapsObstacle } from '../collision/geometry';
import type { EnemyKind } from '../config/gameConfig';
import type { World } from '../simulation/World';

const SPAWN_ATTEMPTS = 16;
const EDGE_MARGIN = 70;
/** When no safe point exists this step, try again shortly instead of waiting a full interval. */
const RETRY_DELAY = 0.25;

export function updateSpawner(world: World, dt: number): void {
  if (world.phase !== 'running') return;
  const spawner = world.spawner;
  spawner.timer -= dt;
  if (spawner.timer > 0) return;

  if (world.aliveEnemyCount() >= world.config.spawn.maxAliveEnemies) {
    spawner.timer += world.config.spawn.intervalSeconds;
    return;
  }
  const point = findSpawnPoint(world);
  if (!point) {
    spawner.timer = RETRY_DELAY;
    return;
  }
  spawnEnemy(world, drawKind(world), point.x, point.y);
  spawner.timer += world.config.spawn.intervalSeconds;
}

export function spawnEnemy(world: World, kind: EnemyKind, x: number, y: number) {
  const heading = Math.atan2(world.player.y - y, world.player.x - x);
  const ship = world.addShip(kind, x, y, heading);
  world.emit({ type: 'enemySpawned', shipId: ship.id, kind, x, y });
  return ship;
}

/**
 * Shuffle bag built from the configured weights: the distribution is exact
 * over every bag, and both enemy kinds are guaranteed to show up early in
 * any match instead of depending on lucky rolls.
 */
function drawKind(world: World): EnemyKind {
  const spawner = world.spawner;
  if (spawner.bag.length === 0) {
    for (const [kind, weight] of Object.entries(world.config.spawn.weights) as [EnemyKind, number][]) {
      for (let i = 0; i < weight; i++) spawner.bag.push(kind);
    }
    for (let i = spawner.bag.length - 1; i > 0; i--) {
      const j = world.rng.int(0, i + 1);
      [spawner.bag[i], spawner.bag[j]] = [spawner.bag[j] as EnemyKind, spawner.bag[i] as EnemyKind];
    }
  }
  return spawner.bag.pop() as EnemyKind;
}

/** Random point near the arena edge, far from the player and clear of islands and ships. */
function findSpawnPoint(world: World): { x: number; y: number } | null {
  const { width, height } = world.config.arena;
  const { minDistanceFromPlayer, clearance } = world.config.spawn;
  const player = world.player;

  for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
    const edge = world.rng.int(0, 4);
    const along = world.rng.next();
    const x = edge === 0 ? EDGE_MARGIN : edge === 1 ? width - EDGE_MARGIN : EDGE_MARGIN + along * (width - EDGE_MARGIN * 2);
    const y = edge === 2 ? EDGE_MARGIN : edge === 3 ? height - EDGE_MARGIN : EDGE_MARGIN + along * (height - EDGE_MARGIN * 2);

    if (Math.hypot(x - player.x, y - player.y) < minDistanceFromPlayer) continue;
    if (world.obstacles.some((obstacle) => overlapsObstacle(x, y, clearance, obstacle))) continue;
    if (world.ships.some((ship) => ship.alive && Math.hypot(ship.x - x, ship.y - y) < clearance * 2)) continue;
    return { x, y };
  }
  return null;
}
