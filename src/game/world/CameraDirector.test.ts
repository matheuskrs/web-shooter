import { describe, expect, it } from 'vitest';
import { CameraDirector } from './CameraDirector';

const DT = 1 / 60;

function run(camera: CameraDirector, seconds: number, onFrame?: () => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    camera.update(DT, 1);
    onFrame?.();
  }
}

describe('CameraDirector', () => {
  it('zooms out on the way and arrives exactly on target', () => {
    const camera = new CameraDirector();
    camera.placeAt({ x: 0, y: 0, zoom: 1 }, false);
    camera.travel([{ to: { x: 1000, y: 0, zoom: 1 }, durationMs: 1000, zoomDip: 0.4, ease: 'inOut' }], false);
    let minZoom = 1;
    run(camera, 1.1, () => (minZoom = Math.min(minZoom, camera.pose.zoom)));
    expect(minZoom).toBeLessThan(0.65);
    expect(camera.pose).toEqual({ x: 1000, y: 0, zoom: 1 });
    expect(camera.isTravelling).toBe(false);
  });

  it('moves slowly at both ends and fastest in the middle', () => {
    const camera = new CameraDirector();
    camera.placeAt({ x: 0, y: 0, zoom: 1 }, false);
    camera.travel([{ to: { x: 1000, y: 0, zoom: 1 }, durationMs: 1000, zoomDip: 0, ease: 'inOut' }], false);
    const speeds: number[] = [];
    run(camera, 1, () => speeds.push(Math.abs(camera.screenVelocity.x)));
    const peak = Math.max(...speeds);
    expect(speeds[0]).toBeLessThan(peak * 0.05);
    expect(speeds[speeds.length - 1]).toBeLessThan(peak * 0.05);
    expect(speeds.indexOf(peak)).toBeGreaterThan(25);
    expect(speeds.indexOf(peak)).toBeLessThan(35);
  });

  it('fires the midpoint once and the arrival after it, leg by leg', () => {
    const camera = new CameraDirector();
    const calls: string[] = [];
    camera.travel(
      [
        { to: { x: 100, y: 0, zoom: 2 }, durationMs: 400, zoomDip: 0.3, ease: 'inOut', onMidpoint: () => calls.push('swap') },
        { to: { x: 0, y: 0, zoom: 1 }, durationMs: 200, zoomDip: 0, ease: 'out', onArrive: () => calls.push('settled') },
      ],
      false,
    );
    run(camera, 1);
    expect(calls).toEqual(['swap', 'settled']);
  });

  it('still fires a pending midpoint when travel is interrupted', () => {
    const camera = new CameraDirector();
    const calls: string[] = [];
    camera.travel([{ to: { x: 100, y: 0, zoom: 1 }, durationMs: 1000, zoomDip: 0, ease: 'inOut', onMidpoint: () => calls.push('swap') }], false);
    run(camera, 0.1);
    camera.travel([{ to: { x: -100, y: 0, zoom: 1 }, durationMs: 0, zoomDip: 0, ease: 'inOut' }], false);
    expect(calls).toEqual(['swap']);
  });

  it('drifts gently towards the top-left while resting', () => {
    const camera = new CameraDirector();
    camera.placeAt({ x: 500, y: 500, zoom: 1 }, true);
    run(camera, 10);
    expect(camera.pose.x).toBeLessThan(500);
    expect(camera.pose.y).toBeLessThan(500);
    expect(Math.hypot(camera.screenVelocity.x, camera.screenVelocity.y)).toBeLessThan(20);
  });
});

describe('CameraDirector drift and anchored UI', () => {
  it('fades the drift out during travel so the undrifted pose moves continuously', () => {
    const camera = new CameraDirector();
    camera.placeAt({ x: 500, y: 500, zoom: 1 }, true);
    run(camera, 20);
    const undrifted = () => ({ x: camera.pose.x - camera.driftOffset.x, y: camera.pose.y - camera.driftOffset.y });
    expect(undrifted().x).toBeCloseTo(500);
    camera.travel([{ to: { x: 2000, y: 500, zoom: 1 }, durationMs: 1000, zoomDip: 0.3, ease: 'inOut' }], false);
    let previous = undrifted();
    let largestJump = 0;
    run(camera, 1.05, () => {
      const next = undrifted();
      largestJump = Math.max(largestJump, Math.hypot(next.x - previous.x, next.y - previous.y));
      previous = next;
    });
    expect(undrifted().x).toBeCloseTo(2000);
    // Fastest frame of a 1.5 km trip in one second is ~47 world units; no jump on departure.
    expect(largestJump).toBeLessThan(60);
  });
});
