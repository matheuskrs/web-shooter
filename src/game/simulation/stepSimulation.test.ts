import { describe, expect, it } from 'vitest';
import { InputState } from '../input/InputState';
import { createFireBuffer } from '../systems/playerControlSystem';
import { spawnEnemy } from '../systems/spawnSystem';
import { createWorld } from '../testing/worldFactory';
import { stepSimulation } from './stepSimulation';
import type { World } from './World';

const DT = 1 / 60;

function run(world: World, input: InputState, seconds: number) {
  const buffer = createFireBuffer();
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepSimulation(world, input, buffer, DT);
}

/** Open sea with no islands keeps rule tests independent from the map. */
function openSeaWorld(seed = 1) {
  const world = createWorld({ seed, obstacles: [] });
  world.spawner.timer = Number.POSITIVE_INFINITY;
  return world;
}

describe('stepSimulation', () => {
  it('moves the player forward along its heading', () => {
    const world = openSeaWorld();
    const input = new InputState();
    const { x: startX, y: startY } = world.requirePlayer();
    input.press('forward', 'test');
    run(world, input, 1);
    expect(world.requirePlayer().x - startX).toBeGreaterThan(150);
    expect(world.requirePlayer().y).toBeCloseTo(startY);
  });

  it('keeps the whole hull inside the arena', () => {
    const world = openSeaWorld();
    const input = new InputState();
    input.press('forward', 'test');
    run(world, input, 10);
    const { radius, circleOffsets } = world.config.player.hull;
    const bowX = world.requirePlayer().x + Math.max(...circleOffsets);
    expect(bowX + radius).toBeLessThanOrEqual(world.config.arena.width + 1e-6);
  });

  it('stops the player at an island instead of passing through', () => {
    const world = createWorld({
      obstacles: [{ kind: 'roundedRect', x: 1000, y: 300, width: 200, height: 240, cornerRadius: 40 }],
    });
    world.spawner.timer = Number.POSITIVE_INFINITY;
    const input = new InputState();
    input.press('forward', 'test');
    run(world, input, 4);
    const { circleOffsets, radius } = world.config.player.hull;
    const bowX = world.requirePlayer().x + Math.max(...circleOffsets) + radius;
    expect(bowX).toBeLessThanOrEqual(1000 + 0.5);
    expect(bowX).toBeGreaterThan(990);
  });

  it('applies a projectile hit once and awards one point per kill', () => {
    const world = openSeaWorld();
    const input = new InputState();
    const enemy = spawnEnemy(world, 'chaser', world.requirePlayer().x + 300, world.requirePlayer().y);
    let hits = 0;
    const buffer = createFireBuffer();
    input.press('fireFront', 'test');
    for (let i = 0; i < 120 && enemy.alive; i++) {
      // Hold the chaser still so the test measures hits, not a ram.
      enemy.speed = 0;
      stepSimulation(world, input, buffer, DT);
      hits += world.events.filter((event) => event.type === 'shipHit').length;
      world.events.length = 0;
    }
    expect(enemy.alive).toBe(false);
    expect(hits).toBe(Math.ceil(world.config.chaser.maxHealth / world.config.player.bowCannon.damage));
    expect(world.score).toBe(1);
  });

  it('fires three parallel balls from a broadside', () => {
    const world = openSeaWorld();
    const input = new InputState();
    input.press('fireLeft', 'test');
    run(world, input, DT);
    const balls = world.projectiles.filter((projectile) => projectile.slot === 'left');
    expect(balls).toHaveLength(3);
    for (const ball of balls) {
      expect(ball.vx).toBeCloseTo(0);
      expect(ball.vy).toBeLessThan(0);
    }
  });

  it('respects weapon cooldowns while the trigger is held', () => {
    const world = openSeaWorld();
    const input = new InputState();
    input.press('fireFront', 'test');
    let shots = 0;
    const buffer = createFireBuffer();
    for (let i = 0; i < 60; i++) {
      stepSimulation(world, input, buffer, DT);
      shots += world.events.filter((event) => event.type === 'shotFired').length;
      world.events.length = 0;
    }
    // Cooldowns tick in whole steps, so the effective interval rounds up to a step.
    const intervalSteps = Math.ceil(world.config.player.bowCannon.cooldownSeconds / DT);
    expect(shots).toBe(Math.floor((60 - 1) / intervalSteps) + 1);
  });

  it('a chaser ram damages the player and does not score', () => {
    const world = openSeaWorld();
    const input = new InputState();
    spawnEnemy(world, 'chaser', world.requirePlayer().x + 200, world.requirePlayer().y);
    run(world, input, 3);
    expect(world.requirePlayer().health).toBe(world.config.player.maxHealth - world.config.chaser.ramDamage);
    expect(world.score).toBe(0);
    expect(world.ships.filter((ship) => ship.kind === 'chaser')).toHaveLength(0);
  });

  it('a shooter holds its distance and fires once in range', () => {
    const world = openSeaWorld();
    const input = new InputState();
    const shooter = spawnEnemy(world, 'shooter', world.requirePlayer().x + 700, world.requirePlayer().y);
    run(world, input, 6);
    const distance = Math.hypot(shooter.x - world.requirePlayer().x, shooter.y - world.requirePlayer().y);
    expect(distance).toBeLessThanOrEqual(world.config.shooter.behaviour.attackRange);
    expect(distance).toBeGreaterThan(world.config.shooter.behaviour.minRange);
    expect(world.requirePlayer().health).toBeLessThan(world.config.player.maxHealth);
  });

  it('spawns both enemy kinds within the first bag', () => {
    const world = createWorld({ seed: 7 });
    const input = new InputState();
    const kinds = new Set<string>();
    const buffer = createFireBuffer();
    for (let i = 0; i < Math.round(16 / DT); i++) {
      stepSimulation(world, input, buffer, DT);
      for (const event of world.events) if (event.type === 'enemySpawned') kinds.add(event.kind);
      world.events.length = 0;
    }
    expect(kinds).toEqual(new Set(['chaser', 'shooter']));
  });

  it('ends on time up and then stops simulating', () => {
    const world = openSeaWorld();
    const input = new InputState();
    run(world, input, world.config.sessionSeconds + 1);
    expect(world.phase).toBe('ended');
    expect(world.endReason).toBe('time_up');
    expect(world.elapsed).toBe(world.config.sessionSeconds);
  });

  it('is deterministic for a given seed', () => {
    const snapshot = (seed: number) => {
      const world = createWorld({ seed });
      const input = new InputState();
      input.press('forward', 'test');
      input.press('turnLeft', 'test');
      run(world, input, 20);
      return world.ships.map((ship) => [ship.kind, ship.x.toFixed(3), ship.y.toFixed(3), ship.health]);
    };
    expect(snapshot(42)).toEqual(snapshot(42));
  });
});
