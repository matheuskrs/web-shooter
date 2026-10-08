import { lerp } from '../math/scalar';

export interface CameraPose {
  x: number;
  y: number;
  zoom: number;
}

export interface TravelLeg {
  to: CameraPose;
  durationMs: number;
  /** Fraction of zoom given up at the leg's midpoint: the "pull back" before swooping in. */
  zoomDip: number;
  /** 'inOut' accelerates then brakes (travel); 'out' only brakes (a final settle). */
  ease: 'inOut' | 'out';
  /** Runs once at the halfway point (fastest, most blurred moment), even if the leg is interrupted. */
  onMidpoint?: () => void;
  /** Runs when the leg completes normally. */
  onArrive?: () => void;
}

interface ActiveLeg extends TravelLeg {
  from: CameraPose;
  elapsedMs: number;
  midpointDone: boolean;
  /** Drift offset at departure, faded out over this leg so anchored UI never jumps. */
  driftFrom: { x: number; y: number } | null;
}

/**
 * Idle drift along a slow diagonal (bottom-right → top-left on screen): the
 * camera eases away from the anchor over half a period, then back.
 */
const DRIFT_DIRECTION = { x: -0.86, y: -0.51 };
const DRIFT_DISTANCE = 1100;
const DRIFT_PERIOD_SECONDS = 240;

/** Smootherstep: velocity rises and falls like a bell, starting and ending at zero. */
function easeInOut(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Small camera brain used by WorldHost. It owns only a pose; WorldHost
 * applies it to the world container. Travel is a queue of legs; when the
 * queue empties the camera rests on its anchor, optionally drifting.
 */
export class CameraDirector {
  readonly pose: CameraPose = { x: 0, y: 0, zoom: 1 };
  /**
   * The idle-drift part of `pose`. World-anchored UI ignores it: panels sit on a
   * layer above the sea, so the water drifts underneath while text stays still.
   */
  readonly driftOffset = { x: 0, y: 0 };
  /** How fast the world moves across the screen (px/s), for motion blur. */
  readonly screenVelocity = { x: 0, y: 0 };
  private legs: ActiveLeg[] = [];
  private anchor: CameraPose = { x: 0, y: 0, zoom: 1 };
  private drifting = false;
  private driftSeconds = 0;

  get isTravelling(): boolean {
    return this.legs.length > 0;
  }

  /** Jumps straight to a pose and rests there. */
  placeAt(anchor: CameraPose, drift: boolean): void {
    this.cancelLegs();
    this.driftOffset.x = this.driftOffset.y = 0;
    this.anchor = { ...anchor };
    Object.assign(this.pose, anchor);
    this.drifting = drift;
    this.driftSeconds = 0;
  }

  /**
   * Replaces any travel in progress with `legs`, starting from the current
   * pose; afterwards the camera rests on the last leg's target.
   */
  travel(legs: readonly TravelLeg[], restDrift: boolean): void {
    this.cancelLegs();
    let from: CameraPose = { ...this.pose };
    let driftFrom: { x: number; y: number } | null = { ...this.driftOffset };
    for (const leg of legs) {
      this.legs.push({ ...leg, from, elapsedMs: 0, midpointDone: false, driftFrom });
      from = leg.to;
      driftFrom = null;
    }
    const last = legs[legs.length - 1];
    if (last) this.anchor = { ...last.to };
    this.drifting = restDrift;
    this.driftSeconds = 0;
  }

  /** @param viewScale world → screen scale at zoom 1, used to express velocity in screen pixels. */
  update(dt: number, viewScale: number): void {
    const previousX = this.pose.x;
    const previousY = this.pose.y;
    const leg = this.legs[0];

    if (leg) {
      leg.elapsedMs += dt * 1000;
      const t = leg.durationMs <= 0 ? 1 : Math.min(1, leg.elapsedMs / leg.durationMs);
      const s = leg.ease === 'inOut' ? easeInOut(t) : easeOut(t);
      this.pose.x = lerp(leg.from.x, leg.to.x, s);
      this.pose.y = lerp(leg.from.y, leg.to.y, s);
      this.pose.zoom = lerp(leg.from.zoom, leg.to.zoom, s) * (1 - leg.zoomDip * Math.sin(Math.PI * t));
      this.driftOffset.x = leg.driftFrom ? leg.driftFrom.x * (1 - s) : 0;
      this.driftOffset.y = leg.driftFrom ? leg.driftFrom.y * (1 - s) : 0;
      if (t >= 0.5 && !leg.midpointDone) {
        leg.midpointDone = true;
        leg.onMidpoint?.();
      }
      if (t >= 1) {
        this.legs.shift();
        leg.onArrive?.();
      }
    } else if (this.drifting) {
      this.driftSeconds += dt;
      const offset = (DRIFT_DISTANCE * (1 - Math.cos((2 * Math.PI * this.driftSeconds) / DRIFT_PERIOD_SECONDS))) / 2;
      this.driftOffset.x = DRIFT_DIRECTION.x * offset;
      this.driftOffset.y = DRIFT_DIRECTION.y * offset;
      this.pose.x = this.anchor.x + this.driftOffset.x;
      this.pose.y = this.anchor.y + this.driftOffset.y;
      this.pose.zoom = this.anchor.zoom;
    }

    const scale = viewScale * this.pose.zoom;
    this.screenVelocity.x = dt > 0 ? (-(this.pose.x - previousX) * scale) / dt : 0;
    this.screenVelocity.y = dt > 0 ? (-(this.pose.y - previousY) * scale) / dt : 0;
  }

  /** Interrupted legs still fire their midpoint, so scene swaps are never skipped. */
  private cancelLegs(): void {
    const pending = this.legs;
    this.legs = [];
    for (const leg of pending) {
      if (!leg.midpointDone) {
        leg.midpointDone = true;
        leg.onMidpoint?.();
      }
    }
  }
}
