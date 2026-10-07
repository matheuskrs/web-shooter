import { useSubmitMatch } from '../../api/queries';
import { GameButton } from '../../components/GameButton';
import { pendingMatchesStore } from '../../storage/matchStorage';
import { useStoredValue } from '../../storage/storedValue';
import { CaptainsLog } from './CaptainsLog';
import { ControlsReference } from './ControlsReference';
import './menu.css';

const titleUrl = new URL('../../../assets/png/default/ui/menu/title_pirate_battle.png', import.meta.url).href;
const titleUrl2x = new URL('../../../assets/png/retina/ui/menu/title_pirate_battle.png', import.meta.url).href;

export function MainMenuScreen({ onPlay, onOptions }: { onPlay: () => void; onOptions: () => void }) {
  const pending = useStoredValue(pendingMatchesStore);
  const submitMatch = useSubmitMatch();

  return (
    <>
      <div className="scene-backdrop" aria-hidden="true" />
      <main className="screen menu-screen">
        <section className="panel menu-panel" aria-labelledby="game-title">
          <h1 id="game-title" className="menu-panel__title">
            <img src={titleUrl} srcSet={`${titleUrl} 1x, ${titleUrl2x} 2x`} alt="Pirate Battle" width={384} height={128} />
          </h1>
          <div className="menu-panel__actions">
            <GameButton autoFocus onClick={onPlay}>
              Play
            </GameButton>
            <GameButton onClick={onOptions}>Options</GameButton>
          </div>
          {pending.length > 0 && (
            <p className="menu-panel__pending" role="status">
              {pending.length === 1 ? '1 battle waiting to be logged.' : `${pending.length} battles waiting to be logged.`}{' '}
              <button type="button" className="link-button" onClick={() => pending.forEach((item) => submitMatch(item.submission))}>
                Retry now
              </button>
            </p>
          )}
          <ControlsReference />
        </section>
        <CaptainsLog />
      </main>
    </>
  );
}
