import type { MatchRecord } from '../api/contracts';
import { createStoredValue, isRecord } from '../storage/storedValue';
import { DEFAULT_SCENARIO, SCENARIOS, type ScenarioId } from './scenarios';

/**
 * State of the simulated backend. MSW handlers run in the page (the service
 * worker only forwards requests), so they can persist confirmed records in
 * localStorage and keep them across refreshes, like a real server would.
 */
export interface MockDatabase {
  /** Grows on every write; reported to clients as `dataVersion`. */
  version: number;
  records: MatchRecord[];
}

const EMPTY_DATABASE: MockDatabase = { version: 1, records: [] };

export const mockDatabaseStore = createStoredValue<MockDatabase>(
  'pirate-battle:mock-db:v1',
  (value): value is MockDatabase => isRecord(value) && typeof value.version === 'number' && Array.isArray(value.records),
  EMPTY_DATABASE,
);

export const scenarioStore = createStoredValue<ScenarioId>(
  'pirate-battle:mock-scenario:v1',
  (value): value is ScenarioId => SCENARIOS.some((scenario) => scenario.id === value),
  DEFAULT_SCENARIO,
);

let requestCounter = 0;
/** Match ids whose first registration attempt has already been "lost" by the timeout-after-commit scenario. */
const lostFirstReplies = new Set<string>();

export function nextRequestIndex(): number {
  requestCounter += 1;
  return requestCounter;
}

export function shouldLoseFirstReply(matchId: string): boolean {
  if (lostFirstReplies.has(matchId)) return false;
  lostFirstReplies.add(matchId);
  return true;
}

/** Restores the initial fixtures-only server and the default scenario. */
export function resetMockServer(): void {
  mockDatabaseStore.reset();
  scenarioStore.reset();
  requestCounter = 0;
  lostFirstReplies.clear();
}

/** Applies `?scenario=<id>` from the URL so demos and tests can pick a scenario by link. */
export function applyScenarioFromUrl(): void {
  const requested = new URLSearchParams(window.location.search).get('scenario');
  if (requested && SCENARIOS.some((scenario) => scenario.id === requested)) scenarioStore.set(requested as ScenarioId);
}
