import { QueryClient } from '@tanstack/react-query';
import { lastResultStore, markPendingAttempt, removePendingMatch } from '../storage/matchStorage';
import { ApiError, toApiError } from './client';
import type { MatchSubmission, RegisterMatchResponse } from './contracts';
import { registerMatch } from './matchesApi';

const MAX_RETRIES = 2;
const fastRetries = import.meta.env.MODE === 'e2e';

export const queryKeys = {
  all: ['pirate-battle'] as const,
  ranking: (configKey: string, page: number) => ['pirate-battle', 'ranking', configKey, page] as const,
  rankingAll: ['pirate-battle', 'ranking'] as const,
  history: (playerId: string, page: number) => ['pirate-battle', 'history', playerId, page] as const,
  historyAll: ['pirate-battle', 'history'] as const,
};

export const registerMatchKey = ['pirate-battle', 'register-match'] as const;

/**
 * Matches re-sent in the background (pending recovery at start-up). Their
 * failures stay quiet: the menu already shows "battles waiting to be logged",
 * and a toast the player did not trigger reads like an unexplained error.
 */
export const quietRegistrations = new Set<string>();

function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && toApiError(error).retryable;
}

function retryDelay(attempt: number): number {
  return fastRetries ? 100 : Math.min(800 * 2 ** attempt, 4000);
}

export interface QueryClientHooks {
  /** A match could not be registered after all retries (it stays pending). */
  onRegistrationFailed?: (error: unknown) => void;
}

export function createQueryClient(hooks: QueryClientHooks = {}): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Always revalidate when a tab is shown again, but show cached rows instantly.
        staleTime: 0,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: shouldRetry,
        retryDelay,
      },
    },
  });

  /**
   * Registration is defined once, on the client, instead of inside a screen:
   * callbacks here run even if the result screen unmounts mid-request, and the
   * same logic serves the result screen, the retry buttons and the recovery
   * of pending matches after a refresh.
   */
  client.setMutationDefaults(registerMatchKey, {
    mutationFn: (submission: MatchSubmission) => registerMatch(submission),
    retry: shouldRetry,
    retryDelay,
    onSuccess: (response: RegisterMatchResponse) => {
      const matchId = response.record.matchId;
      quietRegistrations.delete(matchId);
      removePendingMatch(matchId);
      const last = lastResultStore.get();
      if (last?.submission.matchId === matchId) lastResultStore.set({ ...last, confirmed: true });
      void client.invalidateQueries({ queryKey: queryKeys.rankingAll });
      void client.invalidateQueries({ queryKey: queryKeys.historyAll });
    },
    onError: (error: unknown, submission: MatchSubmission) => {
      markPendingAttempt(submission.matchId, toApiError(error).message);
      if (!quietRegistrations.delete(submission.matchId)) hooks.onRegistrationFailed?.(error);
    },
  });

  return client;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : toApiError(error).message;
}
