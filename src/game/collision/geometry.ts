import { clamp } from '../math/scalar';

/** Axis-aligned rectangle with rounded corners; x/y is the top-left corner. */
export interface RoundedRect {
  kind: 'roundedRect';
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}

export interface CircleShape {
  kind: 'circle';
  x: number;
  y: number;
  radius: number;
}

export type ObstacleShape = RoundedRect | CircleShape;

/** Result of a penetration query, reused to avoid per-frame allocations. */
export interface Penetration {
  /** Unit vector pointing out of the obstacle. */
  normalX: number;
  normalY: number;
  depth: number;
}

export function createPenetration(): Penetration {
  return { normalX: 0, normalY: 0, depth: 0 };
}

/**
 * A rounded rectangle is its inner rectangle (shrunk by the corner radius)
 * inflated by that radius. That makes circle tests a "closest point on a
 * rectangle" query plus a radius comparison.
 */
function circleVsRoundedRect(
  cx: number,
  cy: number,
  radius: number,
  rect: RoundedRect,
  out: Penetration,
): boolean {
  const r = rect.cornerRadius;
  const left = rect.x + r;
  const top = rect.y + r;
  const right = rect.x + rect.width - r;
  const bottom = rect.y + rect.height - r;
  const qx = clamp(cx, left, right);
  const qy = clamp(cy, top, bottom);
  const dx = cx - qx;
  const dy = cy - qy;
  const reach = r + radius;
  const distSq = dx * dx + dy * dy;
  if (distSq >= reach * reach) return false;

  if (distSq > 1e-9) {
    const dist = Math.sqrt(distSq);
    out.normalX = dx / dist;
    out.normalY = dy / dist;
    out.depth = reach - dist;
    return true;
  }

  // Centre is inside the inner rectangle: leave through the nearest side.
  const toLeft = cx - left;
  const toRight = right - cx;
  const toTop = cy - top;
  const toBottom = bottom - cy;
  const nearest = Math.min(toLeft, toRight, toTop, toBottom);
  out.normalX = nearest === toLeft ? -1 : nearest === toRight ? 1 : 0;
  out.normalY = out.normalX !== 0 ? 0 : nearest === toTop ? -1 : 1;
  out.depth = nearest + reach;
  return true;
}

function circleVsCircle(
  cx: number,
  cy: number,
  radius: number,
  other: CircleShape,
  out: Penetration,
): boolean {
  const dx = cx - other.x;
  const dy = cy - other.y;
  const reach = radius + other.radius;
  const distSq = dx * dx + dy * dy;
  if (distSq >= reach * reach) return false;
  const dist = Math.sqrt(distSq);
  if (dist > 1e-9) {
    out.normalX = dx / dist;
    out.normalY = dy / dist;
  } else {
    out.normalX = 1;
    out.normalY = 0;
  }
  out.depth = reach - dist;
  return true;
}

export function circleVsObstacle(
  cx: number,
  cy: number,
  radius: number,
  obstacle: ObstacleShape,
  out: Penetration,
): boolean {
  return obstacle.kind === 'circle'
    ? circleVsCircle(cx, cy, radius, obstacle, out)
    : circleVsRoundedRect(cx, cy, radius, obstacle, out);
}

/** True when a circle of `radius` at (x, y) overlaps the obstacle. */
export function overlapsObstacle(x: number, y: number, radius: number, obstacle: ObstacleShape): boolean {
  return circleVsObstacle(x, y, radius, obstacle, scratch);
}

const scratch = createPenetration();
