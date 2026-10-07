import { Container, Sprite } from 'pixi.js';
import type { ArenaLayout } from '../arena/arenaLayout';
import type { GameTextures } from '../assets/AssetLoader';
import { lerp, lerpAngle } from '../math/scalar';
import { Rng } from '../math/rng';
import type { Projectile, Ship } from '../simulation/entities';
import type { GameEvent } from '../simulation/events';
import type { World } from '../simulation/World';
import { ArenaView } from './ArenaView';
import { EffectsLayer } from './EffectsLayer';
import { GeneratedTextures } from './GeneratedTextures';
import { ShipView } from './ShipView';

const SINK_SECONDS = 1.8;
const SPAWN_FADE_SECONDS = 0.5;
const TRAIL_MAX_LENGTH = 64;
const PLAYER_TRAIL_TINT = 0xffffff;
const ENEMY_TRAIL_TINT = 0xffb27a;

interface ProjectileView {
  ball: Sprite;
  trail: Sprite;
}

interface SinkingWreck {
  view: ShipView;
  age: number;
}

interface Shake {
  strength: number;
  remaining: number;
  duration: number;
}

/**
 * Draws the world. Views are created lazily the first time an entity id is
 * seen and destroyed when the entity leaves the world, so the simulation
 * never needs to know the renderer exists. Everything is positioned in
 * logical arena units inside `scene`; only `scene`'s transform changes with
 * the canvas size.
 */
export class GameRenderer {
  readonly stage = new Container();
  private readonly scene = new Container();
  private readonly arena: ArenaView;
  private readonly shipLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly effects: EffectsLayer;
  private readonly generated = new GeneratedTextures();
  private readonly shipViews = new Map<number, ShipView>();
  private readonly projectileViews = new Map<number, ProjectileView>();
  private readonly spawnAge = new Map<number, number>();
  private readonly wrecks: SinkingWreck[] = [];
  private readonly rng: Rng;
  private readonly shake: Shake = { strength: 0, remaining: 0, duration: 1 };
  private readonly fit = { scale: 1, offsetX: 0, offsetY: 0 };
  private readonly seen = new Set<number>();

  constructor(
    private readonly world: World,
    layout: ArenaLayout,
    private readonly textures: GameTextures,
    seed: number,
  ) {
    // Cosmetic randomness gets its own stream so effects can never change gameplay outcomes.
    this.rng = new Rng(seed ^ 0x9e3779b9);
    this.arena = new ArenaView(world.config.arena, layout, textures, this.generated);
    this.effects = new EffectsLayer(textures, this.generated, this.rng);
    this.scene.addChild(this.arena.container, this.shipLayer, this.projectileLayer, this.effects.container, this.overlayLayer);
    this.stage.addChild(this.scene);
  }

  get spriteCounts() {
    return {
      ships: this.shipViews.size,
      projectiles: this.projectileViews.size,
      wrecks: this.wrecks.length,
      effects: this.effects.count,
    };
  }

  /** Fits the arena inside the canvas without distortion (letterboxing with open sea). */
  resize(width: number, height: number): void {
    const { width: arenaWidth, height: arenaHeight } = this.world.config.arena;
    const scale = Math.min(width / arenaWidth, height / arenaHeight);
    this.fit.scale = scale;
    this.fit.offsetX = (width - arenaWidth * scale) / 2;
    this.fit.offsetY = (height - arenaHeight * scale) / 2;
    this.scene.scale.set(scale);
    this.applySceneOffset(0, 0);
  }

  handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'shotFired': {
          const heavy = event.slot !== 'front';
          const centre = (event.count - 1) / 2;
          for (let i = 0; i < event.count; i++) {
            const along = (i - centre) * event.spacing;
            this.effects.muzzleFlash(
              event.x + Math.cos(event.keelAngle) * along,
              event.y + Math.sin(event.keelAngle) * along,
              event.angle,
              heavy,
              event.team === 'enemy',
            );
          }
          this.shipViews.get(event.shipId)?.recoil(event.slot);
          if (heavy && event.team === 'player') this.addShake(4, 0.18);
          break;
        }
        case 'shipHit':
          this.effects.shipHit(event.x, event.y);
          this.shipViews.get(event.shipId)?.flashHit();
          if (event.team === 'player') this.addShake(6, 0.22);
          break;
        case 'projectileSplash':
          this.effects.splash(event.x, event.y);
          break;
        case 'projectileHitObstacle':
          this.effects.obstacleHit(event.x, event.y);
          break;
        case 'chaserRammed':
          this.addShake(9, 0.3);
          break;
        case 'enemySpawned':
          this.effects.spawnRipple(event.x, event.y);
          this.spawnAge.set(event.shipId, 0);
          break;
        case 'shipDestroyed':
          this.startSinking(event.shipId);
          this.effects.shipExplosion(event.x, event.y, event.team === 'player');
          this.addShake(event.team === 'player' ? 10 : 3.5, event.team === 'player' ? 0.5 : 0.2);
          break;
        case 'matchEnded':
          for (const projectile of this.world.projectiles) this.effects.splash(projectile.x, projectile.y);
          this.clearProjectileViews();
          break;
        default:
          break;
      }
    }
  }

  /**
   * @param alpha  interpolation factor between the previous and current step
   * @param dt     cosmetic time to advance (0 while paused)
   */
  render(alpha: number, dt: number): void {
    this.arena.update(dt);
    this.syncShips(alpha, dt);
    if (this.world.phase === 'running') this.syncProjectiles(alpha);
    this.updateWrecks(dt);
    this.effects.update(dt);
    this.updateShake(dt);
  }

  destroy(): void {
    for (const view of this.shipViews.values()) view.destroy();
    for (const wreck of this.wrecks) wreck.view.destroy();
    this.shipViews.clear();
    this.wrecks.length = 0;
    this.clearProjectileViews();
    this.effects.destroy();
    // Sprites go, shared atlas textures stay (owned by the AssetLoader).
    this.stage.destroy({ children: true });
    this.generated.destroy();
  }

  private syncShips(alpha: number, dt: number): void {
    this.seen.clear();
    for (const ship of this.world.ships) {
      if (!ship.alive) continue;
      this.seen.add(ship.id);
      let view = this.shipViews.get(ship.id);
      if (!view) {
        view = new ShipView(ship.id, ship.kind, this.textures, this.generated);
        this.shipViews.set(ship.id, view);
        this.shipLayer.addChild(view.container);
        this.overlayLayer.addChild(view.healthBar.container);
      }
      this.updateShipView(view, ship, alpha, dt);
    }
    for (const [id, view] of this.shipViews) {
      if (this.seen.has(id)) continue;
      // Left the world without a destroyed event (e.g. match teardown): drop it.
      view.destroy();
      this.shipViews.delete(id);
    }
  }

  private updateShipView(view: ShipView, ship: Ship, alpha: number, dt: number): void {
    view.setPose(
      lerp(ship.prevX, ship.x, alpha),
      lerp(ship.prevY, ship.y, alpha),
      lerpAngle(ship.prevHeading, ship.heading, alpha),
      ship.speed / ship.config.movement.maxSpeed,
    );
    view.setHealth(ship.health, ship.config.maxHealth);
    const age = this.spawnAge.get(ship.id);
    if (age !== undefined) {
      const next = age + dt;
      const fade = Math.min(1, next / SPAWN_FADE_SECONDS);
      view.container.alpha = fade;
      view.healthBar.container.alpha = fade;
      if (fade >= 1) this.spawnAge.delete(ship.id);
      else this.spawnAge.set(ship.id, next);
    }
    view.update(dt);
  }

  private startSinking(shipId: number): void {
    const view = this.shipViews.get(shipId);
    if (!view) return;
    this.shipViews.delete(shipId);
    this.spawnAge.delete(shipId);
    view.wreck();
    this.wrecks.push({ view, age: 0 });
  }

  private updateWrecks(dt: number): void {
    let write = 0;
    for (let read = 0; read < this.wrecks.length; read++) {
      const wreck = this.wrecks[read] as SinkingWreck;
      wreck.age += dt;
      const t = wreck.age / SINK_SECONDS;
      if (t >= 1) {
        wreck.view.destroy();
        continue;
      }
      wreck.view.container.alpha = 1 - t * t;
      wreck.view.container.scale.set(wreck.view.container.scale.x * (1 - dt * 0.12));
      wreck.view.update(dt);
      this.wrecks[write++] = wreck;
    }
    this.wrecks.length = write;
  }

  private syncProjectiles(alpha: number): void {
    this.seen.clear();
    for (const projectile of this.world.projectiles) {
      if (!projectile.alive) continue;
      this.seen.add(projectile.id);
      let view = this.projectileViews.get(projectile.id);
      if (!view) {
        view = this.createProjectileView(projectile);
        this.projectileViews.set(projectile.id, view);
      }
      const x = lerp(projectile.prevX, projectile.x, alpha);
      const y = lerp(projectile.prevY, projectile.y, alpha);
      view.ball.position.set(x, y);
      view.trail.position.set(x, y);
      const travelled = this.weaponRange(projectile) - projectile.remainingDistance;
      view.trail.scale.x = Math.min(TRAIL_MAX_LENGTH, Math.max(0, travelled)) / 128;
    }
    for (const [id, view] of this.projectileViews) {
      if (this.seen.has(id)) continue;
      view.ball.destroy();
      view.trail.destroy();
      this.projectileViews.delete(id);
    }
  }

  private weaponRange(projectile: Projectile): number {
    const config = this.world.config;
    if (projectile.team === 'enemy') return config.shooter.cannon.range;
    return projectile.slot === 'front' ? config.player.bowCannon.range : config.player.broadside.range;
  }

  private createProjectileView(projectile: Projectile): ProjectileView {
    const trail = new Sprite({ texture: this.generated.trail, anchor: { x: 1, y: 0.5 }, alpha: 0.8 });
    trail.rotation = Math.atan2(projectile.vy, projectile.vx);
    trail.scale.set(0, (projectile.radius * 1.4) / 16);
    trail.tint = projectile.team === 'enemy' ? ENEMY_TRAIL_TINT : PLAYER_TRAIL_TINT;
    const ball = new Sprite({ texture: this.textures.ships.cannon_ball, anchor: 0.5 });
    ball.scale.set((projectile.radius * 2) / 10);
    this.projectileLayer.addChild(trail, ball);
    return { ball, trail };
  }

  private clearProjectileViews(): void {
    for (const view of this.projectileViews.values()) {
      view.ball.destroy();
      view.trail.destroy();
    }
    this.projectileViews.clear();
  }

  private addShake(strength: number, duration: number): void {
    if (strength < this.shake.strength * (this.shake.remaining / this.shake.duration)) return;
    this.shake.strength = strength;
    this.shake.duration = duration;
    this.shake.remaining = duration;
  }

  private updateShake(dt: number): void {
    if (this.shake.remaining <= 0) return;
    this.shake.remaining = Math.max(0, this.shake.remaining - dt);
    const falloff = this.shake.remaining / this.shake.duration;
    const amount = this.shake.strength * falloff * falloff;
    this.applySceneOffset(this.rng.range(-amount, amount), this.rng.range(-amount, amount));
  }

  private applySceneOffset(dx: number, dy: number): void {
    this.scene.position.set(this.fit.offsetX + dx * this.fit.scale, this.fit.offsetY + dy * this.fit.scale);
  }
}
