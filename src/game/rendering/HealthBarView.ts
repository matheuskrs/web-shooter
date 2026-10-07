import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { ENEMY_HEALTH_BAR } from '../assets/uiLayout';

/**
 * Official frame + fill art. The fill is clipped from the left along x, as
 * the atlas metadata prescribes (`clip_axis: x`, `clip_origin: left`), by
 * giving the fill sprite a narrower frame of the same texture source;
 * stretching it instead would squash the rounded end caps.
 */
export class HealthBarView {
  readonly container = new Container();
  private readonly fill: Sprite;
  private clipped: Texture | null = null;
  private ratio = 1;

  constructor(
    frameTexture: Texture,
    private readonly fillTexture: Texture,
    scale: number,
  ) {
    const frame = new Sprite(frameTexture);
    this.fill = new Sprite(fillTexture);
    const { fillRect, width, height } = ENEMY_HEALTH_BAR;
    this.fill.position.set(fillRect.x, fillRect.y);
    this.container.addChild(frame, this.fill);
    this.container.pivot.set(width / 2, height);
    this.container.scale.set(scale);
    this.setRatio(1);
  }

  setRatio(ratio: number): void {
    const next = Math.max(0, Math.min(1, ratio));
    if (next === this.ratio && this.clipped) return;
    this.ratio = next;
    const { fillRect } = ENEMY_HEALTH_BAR;
    const base = this.fillTexture.frame;
    const previous = this.clipped;
    this.clipped = new Texture({
      source: this.fillTexture.source,
      frame: new Rectangle(base.x + fillRect.x, base.y + fillRect.y, Math.max(0.01, fillRect.w * next), fillRect.h),
    });
    this.fill.texture = this.clipped;
    this.fill.visible = next > 0;
    // Only the clipped view is ours; the shared source belongs to the asset loader.
    previous?.destroy(false);
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.clipped?.destroy(false);
    this.clipped = null;
  }
}
