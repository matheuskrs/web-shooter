import { useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { diagnostics } from '../../game/diagnostics/diagnostics';
import type { PerfSnapshot } from '../../game/diagnostics/PerfMonitor';
import type { GameSession } from '../../game/core/GameSession';

interface Readout {
  perf: PerfSnapshot | null;
  liveSessions: number;
  listeners: number;
  audioLoops: number;
  heapMb: number | null;
}

/** Chrome-only `performance.memory`; absent elsewhere. */
function usedHeapMb(): number | null {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? memory.usedJSHeapSize / 1_048_576 : null;
}

/**
 * Profiling readout shown with `?perf`. Polls twice a second; it is a
 * developer tool and deliberately outside the normal HUD update path.
 */
export function PerfOverlay({ session }: { session: GameSession | null }) {
  const { audio } = useServices();
  const [readout, setReadout] = useState<Readout | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReadout({
        perf: session?.perfSnapshot ?? null,
        liveSessions: diagnostics.sessionsCreated - diagnostics.sessionsDisposed,
        listeners: diagnostics.attachedListeners,
        audioLoops: audio.activeLoopCount,
        heapMb: usedHeapMb(),
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [session, audio]);

  if (!readout) return null;
  const { perf } = readout;
  const entities = perf ? perf.entities.ships + perf.entities.projectiles + perf.entities.effects + perf.entities.wrecks : 0;
  return (
    <pre className="perf-overlay" aria-hidden="true" data-testid="perf-overlay">
      {[
        `FPS        ${perf ? perf.fps.toFixed(1) : '–'}`,
        `p95 frame  ${perf ? perf.frameP95Ms.toFixed(2) : '–'} ms`,
        `max frame  ${perf ? perf.frameMaxMs.toFixed(2) : '–'} ms`,
        `entities   ${entities} (ships ${perf?.entities.ships ?? 0}, balls ${perf?.entities.projectiles ?? 0}, fx ${perf?.entities.effects ?? 0})`,
        `sessions   ${readout.liveSessions} live / ${diagnostics.sessionsCreated} created`,
        `listeners  ${readout.listeners}   audio loops ${readout.audioLoops}`,
        `JS heap    ${readout.heapMb === null ? 'n/a' : `${readout.heapMb.toFixed(1)} MB`}`,
      ].join('\n')}
    </pre>
  );
}

export function PerfReportPanel() {
  const [copied, setCopied] = useState(false);
  const reports = diagnostics.reports;
  if (reports.length === 0) return null;
  const json = JSON.stringify(
    { reports, sessionsCreated: diagnostics.sessionsCreated, sessionsDisposed: diagnostics.sessionsDisposed, heapMb: usedHeapMb() },
    null,
    2,
  );
  const last = reports[reports.length - 1];
  return (
    <div className="perf-report">
      <p>
        Last match: {last?.averageFps.toFixed(1)} FPS avg · p95 {last?.frameP95Ms.toFixed(2)} ms · peak {last?.peakEntities} entities ·{' '}
        {reports.length} report(s)
      </p>
      <button
        type="button"
        className="link-button"
        onClick={() => {
          void navigator.clipboard.writeText(json).then(() => setCopied(true));
        }}
      >
        {copied ? 'Copied' : 'Copy profiling JSON'}
      </button>
    </div>
  );
}
