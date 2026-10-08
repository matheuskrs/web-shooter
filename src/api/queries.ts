import {
  keepPreviousData,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { PAGE_SIZE, type HistoryPage, type MatchSubmission, type Page, type RankingPage, type RegisterMatchResponse } from './contracts';
import { fetchHistory, fetchRanking } from './matchesApi';
import { queryKeys, quietRegistrations, registerMatchKey } from './queryClient';

/**
 * Second line of defence against stale responses. TanStack Query already
 * cancels a superseded fetch (its AbortSignal reaches Axios), and different
 * pages live under different keys. If an older snapshot still arrives after
 * a newer one for the same key, keep the newer data: `dataVersion` only grows.
 */
export function keepNewest<T extends Page<unknown>>(client: QueryClient, key: QueryKey, incoming: T): T {
  const current = client.getQueryData<T>(key);
  return current && current.dataVersion > incoming.dataVersion ? current : incoming;
}

export function useRankingQuery(configKey: string, page: number) {
  const client = useQueryClient();
  const key = queryKeys.ranking(configKey, page);
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }): Promise<RankingPage> =>
      keepNewest(client, key, await fetchRanking({ configKey, page, pageSize: PAGE_SIZE }, signal)),
    placeholderData: keepPreviousData,
  });
}

export function useHistoryQuery(playerId: string, page: number) {
  const client = useQueryClient();
  const key = queryKeys.history(playerId, page);
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }): Promise<HistoryPage> =>
      keepNewest(client, key, await fetchHistory({ playerId, page, pageSize: PAGE_SIZE }, signal)),
    placeholderData: keepPreviousData,
  });
}

/** Behaviour (mutationFn, retries, cache invalidation) comes from the defaults in queryClient.ts. */
export function useRegisterMatch() {
  return useMutation<RegisterMatchResponse, Error, MatchSubmission>({ mutationKey: registerMatchKey });
}

/** True while any registration for this match is in flight, to avoid parallel duplicate clicks. */
export function useIsRegistering(matchId: string | undefined): boolean {
  const inFlight = useIsMutating({
    mutationKey: registerMatchKey,
    predicate: (mutation) => (mutation.state.variables as MatchSubmission | undefined)?.matchId === matchId,
  });
  return matchId !== undefined && inFlight > 0;
}

/**
 * Starts a registration unless one for the same match is already in flight.
 * Calling `mutate` again before an earlier call settles is fine: every call
 * runs to completion and the shared defaults handle each outcome.
 */
export function useSubmitMatch() {
  const client = useQueryClient();
  const { mutate } = useRegisterMatch();
  return useCallback(
    (submission: MatchSubmission, { quiet = false }: { quiet?: boolean } = {}) => {
      if (quiet) quietRegistrations.add(submission.matchId);
      else quietRegistrations.delete(submission.matchId);
      const alreadyRunning = client
        .getMutationCache()
        .findAll({ mutationKey: registerMatchKey, status: 'pending' })
        .some((mutation) => (mutation.state.variables as MatchSubmission | undefined)?.matchId === submission.matchId);
      if (!alreadyRunning) mutate(submission);
    },
    [client, mutate],
  );
}
