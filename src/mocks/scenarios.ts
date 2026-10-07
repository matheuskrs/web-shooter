import { Rng } from '../game/math/rng';

export type Endpoint = 'ranking' | 'history' | 'register';

export type Failure = 'timeout' | 'network' | 400 | 500 | 503;

export type DataShape = 'normal' | 'empty' | 'many';

export interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  data: DataShape;
  /** Latency in ms for the n-th request handled since the last reset. */
  latency: (endpoint: Endpoint, requestIndex: number) => number;
  failure: (endpoint: Endpoint) => Failure | null;
  /** Store the match, then never answer the first attempt (client times out and retries). */
  timeoutAfterCommit?: boolean;
}

export type ScenarioId =
  | 'success'
  | 'empty'
  | 'many-pages'
  | 'slow'
  | 'variable-latency'
  | 'out-of-order'
  | 'timeout'
  | 'connection-error'
  | 'http-400'
  | 'http-500'
  | 'ranking-failure'
  | 'history-failure'
  | 'register-timeout-after-commit'
  | 'register-unavailable';

const BASE_LATENCY = 300;
const fixed = (ms: number) => () => ms;
const none = () => null;

/** Seeded per request index, so "variable" latency is identical on every run. */
function seededLatency(requestIndex: number): number {
  return Math.round(new Rng(0xc0ffee + requestIndex * 7919).range(150, 1800));
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'success', label: 'Success', description: 'Normal latency, everything works.', data: 'normal', latency: fixed(BASE_LATENCY), failure: none },
  { id: 'empty', label: 'Empty lists', description: 'Ranking and history return no rows.', data: 'empty', latency: fixed(BASE_LATENCY), failure: none },
  { id: 'many-pages', label: 'Many pages', description: 'Large fixture set to exercise pagination.', data: 'many', latency: fixed(BASE_LATENCY), failure: none },
  { id: 'slow', label: 'Slow network', description: 'Every response takes 2.5 seconds.', data: 'normal', latency: fixed(2500), failure: none },
  {
    id: 'variable-latency',
    label: 'Variable latency',
    description: 'Seeded latency between 150 ms and 1.8 s per request.',
    data: 'normal',
    latency: (_endpoint, index) => seededLatency(index),
    failure: none,
  },
  {
    id: 'out-of-order',
    label: 'Out-of-order responses',
    description: 'Odd requests answer after 2.2 s, even ones after 0.25 s, so later requests overtake earlier ones.',
    data: 'many',
    latency: (_endpoint, index) => (index % 2 === 1 ? 2200 : 250),
    failure: none,
  },
  { id: 'timeout', label: 'Timeout', description: 'The server never answers.', data: 'normal', latency: fixed(BASE_LATENCY), failure: () => 'timeout' },
  { id: 'connection-error', label: 'Connection error', description: 'Requests fail at the network level.', data: 'normal', latency: fixed(BASE_LATENCY), failure: () => 'network' },
  { id: 'http-400', label: 'HTTP 400', description: 'Every request is rejected as invalid.', data: 'normal', latency: fixed(BASE_LATENCY), failure: () => 400 },
  { id: 'http-500', label: 'HTTP 500', description: 'Every request fails with a server error.', data: 'normal', latency: fixed(BASE_LATENCY), failure: () => 500 },
  {
    id: 'ranking-failure',
    label: 'Ranking failure',
    description: 'Only the ranking endpoint fails (500).',
    data: 'normal',
    latency: fixed(BASE_LATENCY),
    failure: (endpoint) => (endpoint === 'ranking' ? 500 : null),
  },
  {
    id: 'history-failure',
    label: 'History failure',
    description: 'Only the match history endpoint fails (500).',
    data: 'normal',
    latency: fixed(BASE_LATENCY),
    failure: (endpoint) => (endpoint === 'history' ? 500 : null),
  },
  {
    id: 'register-timeout-after-commit',
    label: 'Timeout after registering',
    description: 'The match is stored but the first answer never arrives; the retry must return the same record.',
    data: 'normal',
    latency: fixed(BASE_LATENCY),
    failure: none,
    timeoutAfterCommit: true,
  },
  {
    id: 'register-unavailable',
    label: 'Service unavailable at match end',
    description: 'Registering a match returns 503; lists still load. Switch back to Success and retry to recover.',
    data: 'normal',
    latency: fixed(BASE_LATENCY),
    failure: (endpoint) => (endpoint === 'register' ? 503 : null),
  },
];

export const DEFAULT_SCENARIO: ScenarioId = 'success';

export function findScenario(id: string | null | undefined): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? (SCENARIOS[0] as Scenario);
}
