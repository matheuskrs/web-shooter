export interface EntityCounts {
  ships: number;
  projectiles: number;
  effects: number;
  wrecks: number;
}

export interface PerfSnapshot {
  fps: number;
  frameP95Ms: number;
  frameMaxMs: number;
  entities: EntityCounts;
}

export interface MatchPerfReport {
  matchSeconds: number;
  frames: number;
  averageFps: number;
  frameP95Ms: number;
  frameP99Ms: number;
  frameMaxMs: number;
  peakEntities: number;
  peakCounts: EntityCounts;
  viewport: { width: number; height: number; devicePixelRatio: number };
  userAgent: string;
}

/** Last ~2 seconds for the live readout. */
const LIVE_WINDOW = 120;

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

/**
 * Records real frame intervals (ticker delta) and entity counts while a
 * battle runs. It only measures; it never feeds back into the simulation.
 * Only created when profiling is requested (`?perf`).
 */
export class PerfMonitor {
  private readonly intervals: number[] = [];
  private readonly live = new Float64Array(LIVE_WINDOW);
  private liveIndex = 0;
  private liveCount = 0;
  private peakEntities = 0;
  private peakCounts: EntityCounts = { ships: 0, projectiles: 0, effects: 0, wrecks: 0 };
  private latest: EntityCounts = { ships: 0, projectiles: 0, effects: 0, wrecks: 0 };

  recordFrame(intervalMs: number, counts: EntityCounts): void {
    this.intervals.push(intervalMs);
    this.live[this.liveIndex] = intervalMs;
    this.liveIndex = (this.liveIndex + 1) % LIVE_WINDOW;
    this.liveCount = Math.min(LIVE_WINDOW, this.liveCount + 1);
    this.latest = counts;
    const total = counts.ships + counts.projectiles + counts.effects + counts.wrecks;
    if (total > this.peakEntities) {
      this.peakEntities = total;
      this.peakCounts = { ...counts };
    }
  }

  snapshot(): PerfSnapshot {
    const window = Array.from(this.live.subarray(0, this.liveCount)).sort((a, b) => a - b);
    const mean = window.reduce((sum, value) => sum + value, 0) / Math.max(1, window.length);
    return {
      fps: mean > 0 ? 1000 / mean : 0,
      frameP95Ms: percentile(window, 0.95),
      frameMaxMs: window[window.length - 1] ?? 0,
      entities: this.latest,
    };
  }

  report(matchSeconds: number): MatchPerfReport {
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const totalMs = this.intervals.reduce((sum, value) => sum + value, 0);
    return {
      matchSeconds,
      frames: this.intervals.length,
      averageFps: totalMs > 0 ? (this.intervals.length * 1000) / totalMs : 0,
      frameP95Ms: percentile(sorted, 0.95),
      frameP99Ms: percentile(sorted, 0.99),
      frameMaxMs: sorted[sorted.length - 1] ?? 0,
      peakEntities: this.peakEntities,
      peakCounts: this.peakCounts,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      userAgent: navigator.userAgent,
    };
  }
}
