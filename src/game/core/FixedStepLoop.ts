export interface FixedStepLoopOptions {
  stepSeconds: number;
  /** Upper bound of steps per frame; extra backlog is dropped instead of simulated. */
  maxStepsPerFrame: number;
  step: (dt: number) => void;
  /** `alpha` in [0, 1) is how far the current time is between the last two steps. */
  render: (alpha: number, frameSeconds: number) => void;
}

/**
 * Accumulator-based fixed timestep: real elapsed time is collected and spent
 * in constant-size simulation steps, so movement, cooldowns and spawns behave
 * identically at 30, 60 or 144 FPS.
 */
export class FixedStepLoop {
  private accumulator = 0;

  constructor(private readonly options: FixedStepLoopOptions) {}

  /** Feeds real elapsed time; returns the number of simulation steps run. */
  advance(elapsedSeconds: number): number {
    const { stepSeconds, maxStepsPerFrame } = this.options;
    // Clamp so a long hitch (or a suspended tab that slipped past the pause
    // handler) cannot fast-forward several seconds of gameplay in one frame.
    this.accumulator += Math.min(Math.max(elapsedSeconds, 0), stepSeconds * maxStepsPerFrame);
    let steps = 0;
    while (this.accumulator >= stepSeconds && steps < maxStepsPerFrame) {
      this.options.step(stepSeconds);
      this.accumulator -= stepSeconds;
      steps++;
    }
    if (steps === maxStepsPerFrame) this.accumulator = Math.min(this.accumulator, stepSeconds);
    this.options.render(this.accumulator / stepSeconds, elapsedSeconds);
    return steps;
  }

  /** Runs exactly `count` steps, ignoring wall time. Used by the manual test clock. */
  runSteps(count: number): void {
    for (let i = 0; i < count; i++) this.options.step(this.options.stepSeconds);
    this.accumulator = 0;
    this.options.render(0, count * this.options.stepSeconds);
  }

  /** Forgets pending time, e.g. on resume, so paused wall time never turns into movement. */
  reset(): void {
    this.accumulator = 0;
  }
}
