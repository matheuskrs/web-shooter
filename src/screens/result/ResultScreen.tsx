import { useEffect } from 'react';
import { navigate } from '../../app/navigation';
import { useIsRegistering, useSubmitMatch } from '../../api/queries';
import { GameButton } from '../../components/GameButton';
import { lastResultStore, pendingMatchesStore } from '../../storage/matchStorage';
import { useStoredValue } from '../../storage/storedValue';
import { formatClock } from '../../utils/format';
import './result.css';

type RegistrationState = 'saved' | 'saving' | 'failed' | 'queued';

const REGISTRATION_TEXT: Readonly<Record<RegistrationState, string>> = {
  saved: 'Logged in the Captain’s Log.',
  saving: 'Logging your battle…',
  failed: 'Not logged yet. It is kept safe and will be retried.',
  queued: 'Waiting to be logged.',
};

export function ResultScreen({ onPlayAgain, onMenu }: { onPlayAgain: () => void; onMenu: () => void }) {
  const last = useStoredValue(lastResultStore);
  const pending = useStoredValue(pendingMatchesStore);
  const submitMatch = useSubmitMatch();
  const matchId = last?.submission.matchId;
  const registering = useIsRegistering(matchId);

  useEffect(() => {
    if (!last) navigate('menu', { replace: true });
  }, [last]);

  if (!last) return null;
  const { submission } = last;
  const pendingEntry = pending.find((item) => item.submission.matchId === matchId);
  const state: RegistrationState = last.confirmed
    ? 'saved'
    : registering
      ? 'saving'
      : pendingEntry?.lastError
        ? 'failed'
        : 'queued';
  const defeated = submission.endReason === 'defeated';

  return (
    <>
      <div className="scene-backdrop" aria-hidden="true" />
      <main className="screen">
        <section className="panel result-panel" aria-labelledby="result-title">
          <h1 id="result-title" className="panel__title">
            {defeated ? 'Ship Sunk' : 'Battle Complete'}
          </h1>
          <p className="result-panel__score" aria-label={`${submission.score} points`}>
            {submission.score}
          </p>
          <p className="result-panel__summary">
            <span>Points</span>
            <span aria-hidden="true">·</span>
            <span aria-label={`Played ${Math.round(submission.durationSeconds)} seconds`}>{formatClock(submission.durationSeconds)}</span>
            <span aria-hidden="true">·</span>
            <span className={defeated ? 'result-panel__reason--defeated' : 'result-panel__reason--timeup'}>
              {defeated ? 'Defeated' : 'Time up'}
            </span>
          </p>

          <div className={`result-registration result-registration--${state}`} role="status" data-state={state}>
            <span>{REGISTRATION_TEXT[state]}</span>
            {(state === 'failed' || state === 'queued') && (
              <button type="button" className="link-button" onClick={() => submitMatch(submission)}>
                Retry now
              </button>
            )}
          </div>
          {state === 'failed' && pendingEntry?.lastError && <p className="result-registration__detail">{pendingEntry.lastError}</p>}

          <div className="result-panel__actions">
            <GameButton autoFocus onClick={onPlayAgain}>
              Play Again
            </GameButton>
            <GameButton variant="secondary" onClick={onMenu}>
              Main Menu
            </GameButton>
          </div>
        </section>
      </main>
    </>
  );
}
