import { Container, Sprite, type Texture } from 'pixi.js';
import type { GameTextures } from '../assets/AssetLoader';
import type { Rng } from '../math/rng';
import type { GeneratedTextures } from './GeneratedTextures';

interface ParticleOptions {
  life: number;
  vx?: number;
  vy?: number;
  /** Fraction of velocity kept per second. */
  drag?: number;
  spin?: number;
  rotation?: number;
  scaleFrom: number;
  scaleTo: number;
  alphaFrom?: number;
  alphaTo?: number;
  tint?: number;
  delay?: number;
}

interface Particle extends Required<Omit<ParticleOptions, 'tint' | 'rotation'>> {
  sprite: Sprite;
  age: number;
}

const SMOKE_TINT = 0xe4e8ec;
const DUST_TINT = 0xe9c98f;
const ENEMY_FLASH_TINT = 0xffc27a;

/**
 * Short-lived cosmetic particles. Each recipe below is a handful of sprites
 * from the official effects/parts art driven by a tiny tween (velocity, drag,
 * scale and alpha over a lifetime). Effects never touch gameplay state.
 */
export class EffectsLayer {
  readonly container = new Container();
  private readonly particles: Particle[] = [];

  constructor(
    private readonly textures: GameTextures,
    private readonly generated: GeneratedTextures,
    private readonly rng: Rng,
  ) {}

  get count(): number {
    return this.particles.length;
  }

  muzzleFlash(x: number, y: number, angle: number, heavy: boolean, enemy: boolean): void {
    const flash = this.ship('explosion_3');
    this.spawn(flash, x, y, {
      life: heavy ? 0.16 : 0.11,
      scaleFrom: heavy ? 0.42 : 0.3,
      scaleTo: heavy ? 0.7 : 0.45,
      alphaTo: 0,
      rotation: angle,
      ...(enemy ? { tint: ENEMY_FLASH_TINT } : {}),
    });
    const puffs = heavy ? 2 : 1;
    for (let i = 0; i < puffs; i++) {
      const speed = this.rng.range(30, 60);
      this.spawn(this.generated.glow, x, y, {
        life: this.rng.range(0.5, 0.8),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.15,
        scaleFrom: 0.6,
        scaleTo: heavy ? 2 : 1.5,
        alphaFrom: 0.7,
        alphaTo: 0,
        tint: SMOKE_TINT,
        delay: i * 0.04,
      });
    }
  }

  shipHit(x: number, y: number): void {
    this.spawn(this.ship('explosion_3'), x, y, { life: 0.22, scaleFrom: 0.25, scaleTo: 0.55, alphaTo: 0 });
    for (let i = 0; i < 3; i++) this.splinter(x, y, 140);
  }

  splash(x: number, y: number): void {
    this.spawn(this.generated.ring, x, y, { life: 0.5, scaleFrom: 0.15, scaleTo: 0.7, alphaFrom: 0.8, alphaTo: 0 });
    this.spawn(this.generated.glow, x, y, { life: 0.3, scaleFrom: 0.5, scaleTo: 1.1, alphaFrom: 0.8, alphaTo: 0 });
  }

  obstacleHit(x: number, y: number): void {
    this.spawn(this.ship('explosion_2'), x, y, {
      life: 0.45,
      scaleFrom: 0.15,
      scaleTo: 0.45,
      alphaFrom: 0.8,
      alphaTo: 0,
      tint: DUST_TINT,
      spin: this.rng.range(-2, 2),
    });
  }

  spawnRipple(x: number, y: number): void {
    for (let i = 0; i < 2; i++) {
      this.spawn(this.generated.ring, x, y, { life: 0.9, scaleFrom: 0.4, scaleTo: 2.2, alphaFrom: 0.55, alphaTo: 0, delay: i * 0.25 });
    }
  }

  /** Layered blast: flash, fireball, smoke, splinters and sailors overboard. */
  shipExplosion(x: number, y: number, big: boolean): void {
    const size = big ? 1.25 : 1;
    this.spawn(this.generated.glow, x, y, { life: 0.25, scaleFrom: 2, scaleTo: 5 * size, alphaFrom: 0.9, alphaTo: 0 });
    this.spawn(this.ship('explosion_1'), x, y, { life: 0.55, scaleFrom: 0.4 * size, scaleTo: 1.15 * size, alphaTo: 0, spin: 0.6 });
    for (let i = 0; i < 3; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const distance = this.rng.range(10, 26);
      this.spawn(this.ship(i === 0 ? 'explosion_2' : 'explosion_3'), x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, {
        life: 0.45,
        scaleFrom: 0.3,
        scaleTo: 0.8 * size,
        alphaTo: 0,
        delay: 0.06 + i * 0.07,
      });
    }
    for (let i = 0; i < 4; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      this.spawn(this.generated.glow, x, y, {
        life: this.rng.range(1, 1.5),
        vx: Math.cos(angle) * 25,
        vy: Math.sin(angle) * 25,
        drag: 0.3,
        scaleFrom: 1.2,
        scaleTo: 3.4 * size,
        alphaFrom: 0.55,
        alphaTo: 0,
        tint: SMOKE_TINT,
        delay: 0.2,
      });
    }
    for (let i = 0; i < 6; i++) this.splinter(x, y, 220);
    for (let i = 0; i < 2; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(30, 55);
      this.spawn(this.ship(`crew_${this.rng.int(1, 7)}`), x, y, {
        life: 2.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.25,
        spin: this.rng.range(-1.5, 1.5),
        scaleFrom: 0.9,
        scaleTo: 0.8,
        alphaFrom: 1,
        alphaTo: 0,
        delay: 0.15,
      });
    }
  }

  update(dt: number): void {
    let write = 0;
    for (let read = 0; read < this.particles.length; read++) {
      const particle = this.particles[read] as Particle;
      particle.age += dt;
      const sprite = particle.sprite;
      if (particle.age < particle.delay) {
        sprite.visible = false;
        this.particles[write++] = particle;
        continue;
      }
      const t = (particle.age - particle.delay) / particle.life;
      if (t >= 1) {
        sprite.destroy();
        continue;
      }
      const keep = Math.pow(particle.drag, dt);
      particle.vx *= keep;
      particle.vy *= keep;
      sprite.visible = true;
      sprite.x += particle.vx * dt;
      sprite.y += particle.vy * dt;
      sprite.rotation += particle.spin * dt;
      const eased = 1 - (1 - t) * (1 - t);
      sprite.scale.set(particle.scaleFrom + (particle.scaleTo - particle.scaleFrom) * eased);
      sprite.alpha = particle.alphaFrom + (particle.alphaTo - particle.alphaFrom) * t;
      this.particles[write++] = particle;
    }
    this.particles.length = write;
  }

  destroy(): void {
    this.particles.length = 0;
    this.container.destroy({ children: true });
  }

  private splinter(x: number, y: number, speed: number): void {
    const angle = this.rng.range(0, Math.PI * 2);
    const velocity = this.rng.range(speed * 0.4, speed);
    this.spawn(this.ship(`wood_${this.rng.int(1, 5)}`), x, y, {
      life: this.rng.range(0.5, 0.9),
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      drag: 0.02,
      spin: this.rng.range(-8, 8),
      rotation: angle,
      scaleFrom: 0.8,
      scaleTo: 0.6,
      alphaFrom: 1,
      alphaTo: 0,
    });
  }

  private ship(name: string): Texture {
    const texture = this.textures.ships[name];
    if (!texture) throw new Error(`Missing effect frame ${name}`);
    return texture;
  }

  private spawn(texture: Texture, x: number, y: number, options: ParticleOptions): void {
    const sprite = new Sprite({ texture, anchor: 0.5 });
    sprite.position.set(x, y);
    sprite.rotation = options.rotation ?? 0;
    if (options.tint !== undefined) sprite.tint = options.tint;
    sprite.visible = false;
    this.container.addChild(sprite);
    this.particles.push({
      sprite,
      age: 0,
      life: options.life,
      vx: options.vx ?? 0,
      vy: options.vy ?? 0,
      drag: options.drag ?? 1,
      spin: options.spin ?? 0,
      scaleFrom: options.scaleFrom,
      scaleTo: options.scaleTo,
      alphaFrom: options.alphaFrom ?? 1,
      alphaTo: options.alphaTo ?? 1,
      delay: options.delay ?? 0,
    });
  }
}
