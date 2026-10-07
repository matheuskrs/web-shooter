import { describe, expect, it } from 'vitest';
import { circleVsObstacle, createPenetration, type RoundedRect } from './geometry';

const island: RoundedRect = { kind: 'roundedRect', x: 100, y: 100, width: 200, height: 100, cornerRadius: 40 };

describe('circleVsObstacle', () => {
  it('detects a circle touching a flat side and pushes it straight out', () => {
    const out = createPenetration();
    expect(circleVsObstacle(200, 95, 10, island, out)).toBe(true);
    expect(out.normalX).toBeCloseTo(0);
    expect(out.normalY).toBeCloseTo(-1);
    expect(out.depth).toBeCloseTo(5);
  });

  it('lets a circle pass the rounded corner where the square box would block it', () => {
    const out = createPenetration();
    // Inside the bounding box corner, but outside the rounded silhouette.
    expect(circleVsObstacle(104, 104, 2, island, out)).toBe(false);
  });

  it('pushes a centre inside the shape out through the nearest side', () => {
    const out = createPenetration();
    expect(circleVsObstacle(150, 150, 5, island, out)).toBe(true);
    expect(out.normalX).toBe(-1);
    expect(out.depth).toBeCloseTo(55);
  });

  it('separates overlapping circles along the centre line', () => {
    const out = createPenetration();
    expect(circleVsObstacle(10, 0, 6, { kind: 'circle', x: 0, y: 0, radius: 6 }, out)).toBe(true);
    expect(out.normalX).toBeCloseTo(1);
    expect(out.depth).toBeCloseTo(2);
  });
});
