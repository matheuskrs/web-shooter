import { Texture } from 'pixi.js';

/**
 * The asset pack has no trail, ripple or soft-glow sprites, so these few are
 * painted once per session on small canvases and shared by every effect.
 */
export class GeneratedTextures {
  /** Horizontal streak, opaque at the right end, fading to the left. */
  readonly trail: Texture;
  /** Thin white ring for water splashes and spawn ripples. */
  readonly ring: Texture;
  /** Soft radial dot used for foam and flashes. */
  readonly glow: Texture;

  constructor() {
    this.trail = paint(128, 16, (context, width, height) => {
      const gradient = context.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(1, 'rgba(255,255,255,1)');
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, 2);
      context.lineTo(width, height - 2);
      context.closePath();
      context.fill();
    });
    this.ring = paint(64, 64, (context, width) => {
      context.strokeStyle = 'rgba(255,255,255,1)';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(width / 2, width / 2, width / 2 - 4, 0, Math.PI * 2);
      context.stroke();
    });
    this.glow = paint(32, 32, (context, width) => {
      const gradient = context.createRadialGradient(width / 2, width / 2, 0, width / 2, width / 2, width / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, width);
    });
  }

  destroy(): void {
    this.trail.destroy(true);
    this.ring.destroy(true);
    this.glow.destroy(true);
  }
}

function paint(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas unavailable');
  draw(context, width, height);
  return Texture.from(canvas);
}
