import type { MatchSubmission } from '../api/contracts';
import { createStoredValue, isRecord } from './storedValue';

/** Stable anonymous identity of this browser's captain. */
export const playerIdStore = createStoredValue<string | null>(
  'pirate-battle:player-id:v1',
  (value): value is string => typeof value === 'string' && value.length > 8,
  null,
);

export function getPlayerId(): string {
  const existing = playerIdStore.get();
  if (existing) return existing;
  const created = crypto.randomUUID();
  playerIdStore.set(created);
  return created;
}

function isSubmission(value: unknown): value is MatchSubmission {
  return (
    isRecord(value) &&
    typeof value.matchId === 'string' &&
    typeof value.playerId === 'string' &&
    typeof value.playerName === 'string' &&
    typeof value.playedAt === 'string' &&
    typeof value.score === 'number' &&
    typeof value.durationSeconds === 'number' &&
    (value.endReason === 'time_up' || value.endReason === 'defeated') &&
    isRecord(value.config) &&
    typeof value.configKey === 'string'
  );
}

/** Last completed match, shown again by the result screen after a refresh. */
export interface LastResult {
  submission: MatchSubmission;
  /** Becomes true once the server confirmed the record. */
  confirmed: boolean;
}

export const lastResultStore = createStoredValue<LastResult | null>(
  'pirate-battle:last-result:v1',
  (value): value is LastResult => isRecord(value) && isSubmission(value.submission) && typeof value.confirmed === 'boolean',
  null,
);

/** A finished match the server has not confirmed yet. Survives refreshes until it is registered. */
export interface PendingMatch {
  submission: MatchSubmission;
  attempts: number;
  lastError: string | null;
}

export const pendingMatchesStore = createStoredValue<PendingMatch[]>(
  'pirate-battle:pending-matches:v1',
  (value): value is PendingMatch[] =>
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && isSubmission(item.submission) && typeof item.attempts === 'number'),
  [],
);

export function addPendingMatch(submission: MatchSubmission): void {
  pendingMatchesStore.update((pending) =>
    pending.some((item) => item.submission.matchId === submission.matchId)
      ? pending
      : [...pending, { submission, attempts: 0, lastError: null }],
  );
}

export function markPendingAttempt(matchId: string, error: string | null): void {
  pendingMatchesStore.update((pending) =>
    pending.map((item) =>
      item.submission.matchId === matchId ? { ...item, attempts: item.attempts + 1, lastError: error } : item,
    ),
  );
}

export function removePendingMatch(matchId: string): void {
  pendingMatchesStore.update((pending) => pending.filter((item) => item.submission.matchId !== matchId));
}
