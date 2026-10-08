import type { Container } from 'pixi.js';
import { buildObstacles } from '../arena/arenaLayout';
import type { GameTextures } from '../assets/AssetLoader';
import { overlapsObstacle } from '../collision/geometry';
import { BASE_GAME_CONFIG, createMatchConfig, DEFAULT_GAME_OPTIONS, type GameConfig, type ShipKind } from '../config/gameConfig';
import { FixedStepLoop } from '../core/FixedStepLoop';
import { Rng } from '../math/rng';
import type { AmbientFrame } from '../rendering/ArenaView';
import { GameRenderer } from '../rendering/GameRenderer';
import { World } from '../simulation/World';
import { updateAttractAi } from '../systems/attractAiSystem';
import { updateMovement } from '../systems/movementSystem';
import { updateProjectiles } from '../systems/projectileSystem';
import { resolveShipCollisions } from '../systems/shipCollisionSystem';
import { updateWeapons } from '../systems/weaponSystem';
import { ATTRACT_BOUNDS, ATTRACT_LAYOUT } from './attractLayout';

const STEP_SECONDS = 1 / 60;
/** Two small fleets: enough for a skirmish on screen, cheap enough to ignore. */
const FLEETS: readonly ShipKind[] = ['player', 'player', 'player', 'shooter', 'shooter', 'chaser'];
const RESPAWN_DELAY_SECONDS = 2.5;
/** Ships this far from the camera are off screen for good; they are recycled near it. */
const RECYCLE_DISTANCE = 2200;
/** Spawn just outside the visible area so new ships sail in rather than pop in. */
const SPAWN_RING = 1050;
const SEA_MARGIN = 31 * 64;

function attractConfig(): GameConfig {
  const config = structuredClone(createMatchConfig(DEFAULT_GAME_OPTIONS)) as GameConfig;
  config.arena = { ...ATTRACT_BOUNDS };
  // Background skirmishes should last a little; tougher hulls keep the fights on screen longer.
  config.player.maxHealth = BASE_GAME_CONFIG.player.maxHealth * 1.5;
  return config;
}

/**
 * The menu's living sea: two fleets fighting with the real movement, weapons,
 * projectile, collision and damage systems, drawn by the real renderer. It is
 * not a match — no player ship, no clock, no score that anyone reads, and
 * nothing is persisted or registered.
 */
export class AttractScene {
  readonly root: Container;
  private readonly world: World;
  private readonly renderer: GameRenderer;
  private readonly loop: FixedStepLoop;
  private readonly rng: Rng;
  private readonly focus = { x: 0, y: 0 };
  private ambient: AmbientFrame = { time: 0, cameraX: 0, cameraY: 0 };
  private respawnTimer = 0;

  constructor(textures: GameTextures, seed: number, focus: { x: number; y: number }) {
    this.rng = new Rng(seed ^ 0x1badb002);
    this.world = new World(attractConfig(), buildObstacles(ATTRACT_LAYOUT), new Rng(seed), null);
    this.renderer = new GameRenderer(this.world, textures, {
      layout: ATTRACT_LAYOUT,
      seed,
      seaMargin: SEA_MARGIN,
      showBoundary: false,
      shake: false,
    });
    this.root = this.renderer.stage;
    this.loop = new FixedStepLoop({
      stepSeconds: STEP_SECONDS,
      maxStepsPerFrame: 3,
      step: (dt) => this.step(dt),
      render: (alpha, frameSeconds) => this.draw(alpha, frameSeconds),
    });
    this.setFocus(focus);
    // Start mid-battle: both fleets already on the water around the first view.
    for (const kind of FLEETS) this.spawnNear(kind, 300 + this.rng.range(0, 500));
    this.draw(0, 0);
  }

  get shipCount(): number {
    return this.world.ships.length;
  }

  /** Where the camera is (or is heading); ships gather and respawn around it. */
  setFocus(point: { x: number; y: number }): void {
    this.focus.x = point.x;
    this.focus.y = point.y;
  }

  update(frameSeconds: number, ambient: AmbientFrame): void {
    this.ambient = ambient;
    if (frameSeconds <= 0) {
      this.draw(0, 0);
      return;
    }
    this.loop.advance(frameSeconds);
  }

  destroy(): void {
    this.renderer.destroy();
  }

  private step(dt: number): void {
    updateAttractAi(this.world, this.focus, dt);
    updateMovement(this.world, dt);
    resolveShipCollisions(this.world, dt);
    updateWeapons(this.world, dt);
    updateProjectiles(this.world, dt);
    this.recycleFarShips();
    this.world.removeDead();
    this.refillFleets(dt);
  }

  private draw(alpha: number, frameSeconds: number): void {
    const events = this.world.events;
    if (events.length > 0) {
      this.renderer.handleEvents(events);
      events.length = 0;
    }
    this.renderer.render(alpha, frameSeconds, this.ambient);
  }

  /** Off-screen stragglers are quietly removed (no explosion, nothing is "killed"). */
  private recycleFarShips(): void {
    for (const ship of this.world.ships) {
      if (Math.hypot(ship.x - this.focus.x, ship.y - this.focus.y) > RECYCLE_DISTANCE) ship.alive = false;
    }
  }

  private refillFleets(dt: number): void {
    if (this.world.ships.length >= FLEETS.length) return;
    this.respawnTimer -= dt;
    if (this.respawnTimer > 0) return;
    this.respawnTimer = RESPAWN_DELAY_SECONDS;
    const missing = [...FLEETS];
    for (const ship of this.world.ships) {
      const index = missing.indexOf(ship.kind);
      if (index >= 0) missing.splice(index, 1);
    }
    const kind = missing[0];
    if (kind) this.spawnNear(kind, SPAWN_RING);
  }

  private spawnNear(kind: ShipKind, distance: number): void {
    const { width, height } = ATTRACT_BOUNDS;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const x = this.focus.x + Math.cos(angle) * distance;
      const y = this.focus.y + Math.sin(angle) * distance;
      if (x < 120 || y < 120 || x > width - 120 || y > height - 120) continue;
      if (this.world.obstacles.some((obstacle) => overlapsObstacle(x, y, 70, obstacle))) continue;
      const heading = Math.atan2(this.focus.y - y, this.focus.x - x) + this.rng.range(-0.6, 0.6);
      this.world.addShip(kind, x, y, heading);
      return;
    }
  }
}
