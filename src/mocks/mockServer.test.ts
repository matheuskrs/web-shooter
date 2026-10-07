import { describe, expect, it } from 'vitest';
import type { MatchSubmission } from '../api/contracts';
import { buildHistoryPage, buildRankingPage, registerSubmission, validateSubmission } from './mockServer';
import type { MockDatabase } from './mockState';

const configKey = 'r1-t120-s3';

function submission(overrides: Partial<MatchSubmission> = {}): MatchSubmission {
  return {
    matchId: 'match-0001-abcd',
    playerId: 'player-1',
    playerName: 'Captain Test',
    playedAt: '2026-10-01T10:00:00.000Z',
    score: 7,
    durationSeconds: 120,
    endReason: 'time_up',
    config: { sessionSeconds: 120, spawnIntervalSeconds: 3, rulesetVersion: 1 },
    configKey,
    ...overrides,
  };
}

const empty: MockDatabase = { version: 1, records: [] };

describe('registerSubmission', () => {
  it('stores a new match once and returns the same record on retry', () => {
    const first = registerSubmission(empty, submission(), new Date('2026-10-01T10:00:05Z'));
    expect(first.kind).toBe('created');
    if (first.kind !== 'created') return;

    const retry = registerSubmission(first.db, submission(), new Date('2026-10-01T10:00:09Z'));
    expect(retry.kind).toBe('existing');
    if (retry.kind !== 'existing') return;
    expect(retry.record).toEqual(first.record);
    expect(first.db.records).toHaveLength(1);
  });

  it('rejects a different result reusing the same match id', () => {
    const first = registerSubmission(empty, submission(), new Date());
    if (first.kind !== 'created') throw new Error('expected created');
    expect(registerSubmission(first.db, submission({ score: 99 }), new Date()).kind).toBe('conflict');
  });

  it('validates the payload', () => {
    expect(validateSubmission({ ...submission(), score: -1 })).toBeTypeOf('string');
    expect(validateSubmission({ ...submission(), durationSeconds: 500 })).toBeTypeOf('string');
    expect(validateSubmission(submission())).toBeTypeOf('object');
  });
});

describe('buildRankingPage', () => {
  it('only compares matches with the same configuration', () => {
    const created = registerSubmission(empty, submission({ configKey: 'r1-t60-s2', score: 999 }), new Date());
    if (created.kind !== 'created') throw new Error('expected created');
    const page = buildRankingPage(created.db, 'normal', configKey, 1, 50);
    expect(page.items.some((entry) => entry.score === 999)).toBe(false);
  });

  it('orders by score, then earliest match, then match id', () => {
    let db = empty;
    for (const [matchId, playedAt] of [
      ['match-b-0000', '2026-10-01T10:00:00.000Z'],
      ['match-a-0000', '2026-10-01T10:00:00.000Z'],
      ['match-c-0000', '2026-09-30T10:00:00.000Z'],
    ] as const) {
      const outcome = registerSubmission(db, submission({ matchId, playedAt, score: 500 }), new Date());
      if (outcome.kind === 'created') db = outcome.db;
    }
    const top = buildRankingPage(db, 'normal', configKey, 1, 3).items.map((entry) => entry.matchId);
    expect(top).toEqual(['match-c-0000', 'match-a-0000', 'match-b-0000']);
  });

  it('is deterministic and paginates', () => {
    const first = buildRankingPage(empty, 'many', configKey, 2, 5);
    const second = buildRankingPage(empty, 'many', configKey, 2, 5);
    expect(first).toEqual(second);
    expect(first.items).toHaveLength(5);
    expect(first.items[0]?.rank).toBe(6);
    expect(first.totalPages).toBeGreaterThan(5);
  });

  it('returns no rows for the empty scenario', () => {
    expect(buildRankingPage(empty, 'empty', configKey, 1, 5).items).toEqual([]);
    expect(buildHistoryPage(empty, 'empty', 'player-1', 1, 5, 'You', configKey).items).toEqual([]);
  });
});
