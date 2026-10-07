import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from './FixedStepLoop';

function createLoop() {
  const calls = { steps: 0, alphas: [] as number[] };
  const loop = new FixedStepLoop({
    stepSeconds: 1 / 60,
    maxStepsPerFrame: 5,
    step: () => calls.steps++,
    render: (alpha) => calls.alphas.push(alpha),
  });
  return { loop, calls };
}

describe('FixedStepLoop', () => {
  it('runs the same number of steps regardless of frame rate', () => {
    const at30 = createLoop();
    const at144 = createLoop();
    for (let i = 0; i < 30; i++) at30.loop.advance(1 / 30);
    for (let i = 0; i < 144; i++) at144.loop.advance(1 / 144);
    expect(Math.abs(at30.calls.steps - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(at144.calls.steps - 60)).toBeLessThanOrEqual(1);
  });

  it('caps catch-up after a long hitch instead of simulating it', () => {
    const { loop, calls } = createLoop();
    loop.advance(3);
    expect(calls.steps).toBe(5);
    loop.advance(0);
    expect(calls.steps).toBeLessThanOrEqual(6);
  });

  it('forgets accumulated time on reset', () => {
    const { loop, calls } = createLoop();
    loop.advance(0.01);
    loop.reset();
    loop.advance(0.01);
    // 0.02s would have produced a step without the reset.
    expect(calls.steps).toBe(0);
  });
});
