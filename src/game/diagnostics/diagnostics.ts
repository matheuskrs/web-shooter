import type { MatchPerfReport } from './PerfMonitor';

/**
 * Page-wide counters used to verify cleanup across repeated
 * start → play → leave cycles, plus the perf reports of finished matches.
 * Plain numbers only; nothing here holds references to live objects.
 */
export const diagnostics = {
  sessionsCreated: 0,
  sessionsDisposed: 0,
  /** Ticker callbacks and window/document listeners currently attached by sessions. */
  attachedListeners: 0,
  reports: [] as MatchPerfReport[],
};

export const perfModeEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf');
