import { Container, Sprite, type Texture } from 'pixi.js';
import type { GameTextures } from '../assets/AssetLoader';
import type { ShipKind } from '../config/gameConfig';
import { clamp } from '../math/scalar';
import type { WeaponSlot } from '../simulation/entities';
import type { GeneratedTextures } from './GeneratedTextures';
import { HealthBarView } from './HealthBarView';
import { damageStage, SHIP_ART, type ShipArt } from './shipArt';

const HEALTH_BAR_SCALE = 0.42;
const HEALTH_BAR_GAP = 62;
/** Keeps the bar on screen when a ship hugs the top edge of the arena. */
const HEALTH_BAR_MIN_Y = 20;
const HIT_FLASH_SECONDS = 0.12;
const HIT_TINT = 0xff9a8a;
const RECOIL_DISTANCE = 5;
const RECOIL_RECOVERY = 14;
const WAKE_SPREAD = 0.28;

/**
 * Visual twin of one simulated ship. It never reads the world directly: the
 * renderer pushes interpolated poses and health, and the view animates the
 * purely cosmetic parts (flames, wake, recoil, hit flash) on its own clock.
 */
export class ShipView {
  /** Rotates with the ship. In local space the bow points along +y, port along +x. */
  readonly container = new Container();
  readonly healthBar: HealthBarView;
  private readonly body: Sprite;
  private readonly flames: Sprite[] = [];
  private readonly wakes: Sprite[];
  private readonly art: ShipArt;
  private stage: 0 | 1 | 2 | 3 = 0;
  private flashTimer = 0;
  private recoilX = 0;
  private recoilY = 0;
  /** Per-ship phase offset so flames do not flicker in sync; derived from the id to stay deterministic. */
  private time: number;

  constructor(
    readonly id: number,
    readonly kind: ShipKind,
    private readonly textures: GameTextures,
    generated: GeneratedTextures,
  ) {
    this.art = SHIP_ART[kind];
    this.time = (id * 1.618) % 10;
    this.wakes = [-1, 1].map((side) => {
      const wake = new Sprite({ texture: generated.trail, anchor: { x: 1, y: 0.5 }, alpha: 0 });
      wake.rotation = -Math.PI / 2 + side * WAKE_SPREAD;
      wake.position.set(side * 6, -this.art.sternOffset * 0.55);
      return wake;
    });
    this.body = new Sprite({ texture: this.stageTexture(0), anchor: 0.5 });
    this.container.addChild(...this.wakes, this.body);
    this.container.scale.set(this.art.scale);

    for (const [index, point] of this.art.flamePoints.entries()) {
      const flame = new Sprite({ texture: textures.ships[index === 0 ? 'fire_2' : 'fire_1'], anchor: { x: 0.5, y: 0.9 } });
      flame.position.set(point.x, point.y);
      flame.visible = false;
      this.flames.push(flame);
      this.container.addChild(flame);
    }

    const fill = kind === 'player' ? textures.healthFillGreen : textures.healthFillRed;
    this.healthBar = new HealthBarView(textures.healthFrame, fill, HEALTH_BAR_SCALE);
  }

  setPose(x: number, y: number, heading: number, speedRatio: number): void {
    this.container.position.set(x, y);
    this.container.rotation = heading - Math.PI / 2;
    this.healthBar.container.position.set(x, Math.max(HEALTH_BAR_MIN_Y, y - HEALTH_BAR_GAP));
    const wakeAlpha = clamp(speedRatio, 0, 1) * 0.6;
    for (const wake of this.wakes) {
      wake.alpha = wakeAlpha;
      wake.scale.set(0.3 + speedRatio * 0.7, 1.1);
    }
  }

  setHealth(health: number, maxHealth: number): void {
    this.healthBar.setRatio(health / maxHealth);
    const stage = damageStage(health, maxHealth);
    if (stage !== this.stage && this.stage !== 3) {
      this.stage = stage;
      this.body.texture = this.stageTexture(stage);
    }
    for (const [index, flame] of this.flames.entries()) flame.visible = stage > index;
  }

  flashHit(): void {
    this.flashTimer = HIT_FLASH_SECONDS;
  }

  /** Visual kick away from the firing side. */
  recoil(slot: WeaponSlot): void {
    if (slot === 'front') this.recoilY = -RECOIL_DISTANCE * 0.6;
    else this.recoilX = slot === 'left' ? -RECOIL_DISTANCE : RECOIL_DISTANCE;
  }

  /** Switch to the grey wreck art; the renderer then sinks and removes it. */
  wreck(): void {
    this.stage = 3;
    this.body.texture = this.stageTexture(3);
    this.body.tint = 0xffffff;
    for (const wake of this.wakes) wake.visible = false;
    this.healthBar.container.visible = false;
  }

  update(dt: number): void {
    this.time += dt;
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.body.tint = this.flashTimer > 0 ? HIT_TINT : 0xffffff;

    const settle = Math.exp(-RECOIL_RECOVERY * dt);
    this.recoilX *= settle;
    this.recoilY *= settle;
    this.body.position.set(this.recoilX, this.recoilY);

    // Flames are side-view art: keep them upright on screen and let them flicker.
    for (const [index, flame] of this.flames.entries()) {
      if (!flame.visible) continue;
      flame.rotation = -this.container.rotation;
      const flicker = Math.sin(this.time * (17 + index * 5)) * 0.08 + Math.sin(this.time * 7.3 + index) * 0.06;
      flame.scale.set(0.75 + flicker, 0.8 + flicker * 1.6);
    }
  }

  destroy(): void {
    this.healthBar.destroy();
    this.container.destroy({ children: true });
  }

  private stageTexture(stage: 0 | 1 | 2 | 3): Texture {
    const texture = this.textures.ships[this.art.stages[stage]];
    if (!texture) throw new Error(`Missing ship frame ${this.art.stages[stage]}`);
    return texture;
  }
}
