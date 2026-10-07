import type { HistoryPage, MatchRecord, MatchSubmission, RankingEntry, RankingPage } from '../api/contracts';
import { FIXTURE_COUNTS, historyFixtures, rankingFixtures } from './fixtures';
import type { MockDatabase } from './mockState';
import type { DataShape } from './scenarios';

/**
 * Ranking order, fully deterministic:
 *   1. higher score first
 *   2. on equal score, the match played earlier ranks higher (it got there first)
 *   3. finally the match id, so even identical timestamps never shuffle
 */
export function compareRanking(a: MatchRecord, b: MatchRecord): number {
  return b.score - a.score || a.playedAt.localeCompare(b.playedAt) || a.matchId.localeCompare(b.matchId);
}

function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageSize,
    totalItems,
    totalPages,
  };
}

export function buildRankingPage(db: MockDatabase, shape: DataShape, configKey: string, page: number, pageSize: number): RankingPage {
  const fixtures =
    shape === 'empty' ? [] : rankingFixtures(configKey, shape === 'many' ? FIXTURE_COUNTS.rankingMany : FIXTURE_COUNTS.rankingNormal);
  const own = shape === 'empty' ? [] : db.records.filter((record) => record.configKey === configKey);
  const ranked: RankingEntry[] = [...fixtures, ...own].sort(compareRanking).map((record, index) => ({
    rank: index + 1,
    matchId: record.matchId,
    playerId: record.playerId,
    playerName: record.playerName,
    score: record.score,
    durationSeconds: record.durationSeconds,
    playedAt: record.playedAt,
  }));
  return { ...paginate(ranked, page, pageSize), configKey, dataVersion: db.version };
}

export function buildHistoryPage(
  db: MockDatabase,
  shape: DataShape,
  playerId: string,
  page: number,
  pageSize: number,
  playerName: string,
  configKey: string,
): HistoryPage {
  const own = shape === 'empty' ? [] : db.records.filter((record) => record.playerId === playerId);
  const extra = shape === 'many' ? historyFixtures(playerId, playerName, configKey, FIXTURE_COUNTS.historyMany) : [];
  const ordered = [...own, ...extra].sort((a, b) => b.playedAt.localeCompare(a.playedAt) || a.matchId.localeCompare(b.matchId));
  return { ...paginate(ordered, page, pageSize), playerId, dataVersion: db.version };
}

export type RegisterOutcome =
  | { kind: 'created'; record: MatchRecord; db: MockDatabase }
  | { kind: 'existing'; record: MatchRecord }
  | { kind: 'conflict'; message: string };

export function validateSubmission(body: unknown): MatchSubmission | string {
  if (typeof body !== 'object' || body === null) return 'Body must be a JSON object.';
  const s = body as Partial<MatchSubmission>;
  if (typeof s.matchId !== 'string' || s.matchId.length < 8) return 'matchId is required.';
  if (typeof s.playerId !== 'string' || !s.playerId) return 'playerId is required.';
  if (typeof s.playerName !== 'string' || !s.playerName.trim()) return 'playerName is required.';
  if (typeof s.playedAt !== 'string' || Number.isNaN(Date.parse(s.playedAt))) return 'playedAt must be an ISO date.';
  if (!Number.isInteger(s.score) || (s.score ?? -1) < 0) return 'score must be a non-negative integer.';
  if (s.endReason !== 'time_up' && s.endReason !== 'defeated') return 'endReason is invalid.';
  if (typeof s.configKey !== 'string' || typeof s.config !== 'object' || s.config === null) return 'config is required.';
  if (typeof s.durationSeconds !== 'number' || s.durationSeconds < 0 || s.durationSeconds > s.config.sessionSeconds + 1) {
    return 'durationSeconds is out of range.';
  }
  return s as MatchSubmission;
}

/**
 * Idempotent by matchId: the first submission is stored, any repeat returns
 * the stored record untouched, so retries after a lost response can never
 * create a second history row or ranking entry.
 */
export function registerSubmission(db: MockDatabase, submission: MatchSubmission, now: Date): RegisterOutcome {
  const existing = db.records.find((record) => record.matchId === submission.matchId);
  if (existing) {
    if (existing.score !== submission.score || existing.playerId !== submission.playerId) {
      return { kind: 'conflict', message: 'A different result was already registered for this match.' };
    }
    return { kind: 'existing', record: existing };
  }
  const record: MatchRecord = { ...submission, recordedAt: now.toISOString() };
  return { kind: 'created', record, db: { version: db.version + 1, records: [...db.records, record] } };
}
