import { delay, http, HttpResponse } from 'msw';
import { PAGE_SIZE, type ApiErrorBody } from '../api/contracts';
import { configKeyOf, DEFAULT_GAME_OPTIONS } from '../game/config/gameConfig';
import { mockDatabaseStore, nextRequestIndex, scenarioStore, shouldLoseFirstReply } from './mockState';
import { buildHistoryPage, buildRankingPage, registerSubmission, validateSubmission } from './mockServer';
import { findScenario, type Endpoint } from './scenarios';

function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

/**
 * Applies the active scenario's latency and failure for this endpoint.
 * Returns a ready error response, or null when the request should succeed.
 */
async function simulateNetwork(endpoint: Endpoint): Promise<Response | null> {
  const scenario = findScenario(scenarioStore.get());
  const index = nextRequestIndex();
  const failure = scenario.failure(endpoint);
  if (failure === 'timeout') await delay('infinite');
  await delay(scenario.latency(endpoint, index));
  if (failure === 'network') return HttpResponse.error();
  if (failure === 400) return errorResponse(400, 'bad_request', 'The request was rejected by the server.');
  if (failure === 500) return errorResponse(500, 'internal_error', 'The server failed to process the request.');
  if (failure === 503) return errorResponse(503, 'unavailable', 'The match service is temporarily unavailable.');
  return null;
}

function pageParam(url: URL): number {
  const page = Number(url.searchParams.get('page') ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function pageSizeParam(url: URL): number {
  const size = Number(url.searchParams.get('pageSize') ?? PAGE_SIZE);
  return Number.isInteger(size) && size > 0 && size <= 50 ? size : PAGE_SIZE;
}

export const handlers = [
  http.get('/api/ranking', async ({ request }) => {
    const failed = await simulateNetwork('ranking');
    if (failed) return failed;
    const url = new URL(request.url);
    const configKey = url.searchParams.get('configKey');
    if (!configKey) return errorResponse(400, 'bad_request', 'configKey is required.');
    const shape = findScenario(scenarioStore.get()).data;
    return HttpResponse.json(buildRankingPage(mockDatabaseStore.get(), shape, configKey, pageParam(url), pageSizeParam(url)));
  }),

  http.get('/api/players/:playerId/matches', async ({ request, params }) => {
    const failed = await simulateNetwork('history');
    if (failed) return failed;
    const url = new URL(request.url);
    const playerId = String(params.playerId);
    const shape = findScenario(scenarioStore.get()).data;
    return HttpResponse.json(
      buildHistoryPage(mockDatabaseStore.get(), shape, playerId, pageParam(url), pageSizeParam(url), 'You', configKeyOf(DEFAULT_GAME_OPTIONS)),
    );
  }),

  http.post('/api/matches', async ({ request }) => {
    const failed = await simulateNetwork('register');
    if (failed) return failed;
    const submission = validateSubmission(await request.json().catch(() => null));
    if (typeof submission === 'string') return errorResponse(400, 'invalid_match', submission);

    const outcome = registerSubmission(mockDatabaseStore.get(), submission, new Date());
    switch (outcome.kind) {
      case 'conflict':
        return errorResponse(409, 'conflict', outcome.message);
      case 'existing':
        return HttpResponse.json({ record: outcome.record, created: false }, { status: 200 });
      case 'created':
        mockDatabaseStore.set(outcome.db);
        // The record is committed; now drop the reply so the client times out and retries.
        if (findScenario(scenarioStore.get()).timeoutAfterCommit && shouldLoseFirstReply(submission.matchId)) {
          await delay('infinite');
        }
        return HttpResponse.json({ record: outcome.record, created: true }, { status: 201 });
    }
  }),
];
