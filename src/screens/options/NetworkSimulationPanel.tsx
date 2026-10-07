import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSubmitMatch } from '../../api/queries';
import { queryKeys } from '../../api/queryClient';
import { resetMockServer, scenarioStore } from '../../mocks/mockState';
import { findScenario, SCENARIOS, type ScenarioId } from '../../mocks/scenarios';
import { pendingMatchesStore } from '../../storage/matchStorage';
import { useStoredValue } from '../../storage/storedValue';

/**
 * Developer tools for the simulated ranking/history backend. Kept collapsed
 * so the player-facing options stay short; the same controls are available
 * by URL (`?scenario=<id>`) for demos and tests.
 */
export function NetworkSimulationPanel() {
  const scenarioId = useStoredValue(scenarioStore);
  const pending = useStoredValue(pendingMatchesStore);
  const submitMatch = useSubmitMatch();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const scenario = findScenario(scenarioId);

  return (
    <details className="netsim">
      <summary>Network simulation</summary>
      <div className="netsim__body">
        <label htmlFor="scenario" className="options-field__label">
          Mock API scenario
        </label>
        <select
          id="scenario"
          className="options-input options-input--select"
          value={scenarioId}
          aria-describedby="scenario-description"
          onChange={(event) => {
            scenarioStore.set(event.target.value as ScenarioId);
            setMessage('');
          }}
        >
          {SCENARIOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <p id="scenario-description" className="options-field__hint">
          {scenario.description}
        </p>

        <p className="netsim__pending" data-testid="pending-count">
          Pending uploads: {pending.length}
          {pending.length > 0 && pending[0]?.lastError ? ` (last error: ${pending[0].lastError})` : ''}
        </p>
        <div className="netsim__actions">
          <button
            type="button"
            className="netsim__button"
            disabled={pending.length === 0}
            onClick={() => {
              for (const item of pending) submitMatch(item.submission);
              setMessage('Retrying pending uploads…');
            }}
          >
            Retry pending uploads
          </button>
          <button
            type="button"
            className="netsim__button"
            onClick={() => {
              resetMockServer();
              queryClient.removeQueries({ queryKey: queryKeys.all });
              setMessage('Mock server reset to its initial fixtures and the Success scenario.');
            }}
          >
            Reset mock server
          </button>
        </div>
        <p className="status-text" role="status">
          {message}
        </p>
      </div>
    </details>
  );
}
