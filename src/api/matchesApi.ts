import { http, toApiError } from './client';
import {
  IDEMPOTENCY_HEADER,
  type HistoryPage,
  type MatchSubmission,
  type RankingPage,
  type RegisterMatchResponse,
} from './contracts';

async function request<T>(run: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await run()).data;
  } catch (error) {
    throw toApiError(error);
  }
}

export function registerMatch(submission: MatchSubmission): Promise<RegisterMatchResponse> {
  return request(() =>
    http.post<RegisterMatchResponse>('/matches', submission, {
      headers: { [IDEMPOTENCY_HEADER]: submission.matchId },
    }),
  );
}

export function fetchRanking(params: { configKey: string; page: number; pageSize: number }, signal?: AbortSignal): Promise<RankingPage> {
  return request(() => http.get<RankingPage>('/ranking', { params, signal }));
}

export function fetchHistory(
  params: { playerId: string; page: number; pageSize: number },
  signal?: AbortSignal,
): Promise<HistoryPage> {
  const { playerId, ...query } = params;
  return request(() => http.get<HistoryPage>(`/players/${encodeURIComponent(playerId)}/matches`, { params: query, signal }));
}
