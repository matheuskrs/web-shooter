import { useSubmitMatch } from '../../api/queries';
import type { Route } from '../../app/navigation';
import { GameButton } from '../../components/GameButton';
import { pendingMatchesStore } from '../../storage/matchStorage';
import { useStoredValue } from '../../storage/storedValue';
import { useUiClick } from '../../hooks/useUiClick';
import { ControlsReference } from './ControlsReference';
import './menu.css';

const titleUrl = new URL('../../../assets/png/default/ui/menu/title_pirate_battle.png', import.meta.url).href;
const titleUrl2x = new URL('../../../assets/png/retina/ui/menu/title_pirate_battle.png', import.meta.url).href;

interface MainMenuScreenProps {
  onPlay: () => void;
  onNavigate: (route: Route) => void;
}

export function MainMenuScreen({ onPlay, onNavigate }: MainMenuScreenProps) {
  const pending = useStoredValue(pendingMatchesStore);
  const submitMatch = useSubmitMatch();
  const click = useUiClick();

  return (
    <main className="screen menu-screen">
      <section className="panel menu-panel" aria-labelledby="game-title">
        <h1 id="game-title" className="menu-panel__title">
          <img src={titleUrl} srcSet={`${titleUrl} 1x, ${titleUrl2x} 2x`} alt="Pirate Battle" width={384} height={128} />
        </h1>
        <div className="menu-panel__actions">
          <GameButton onClick={onPlay}>
            Play
          </GameButton>
          <GameButton onClick={() => onNavigate('options')}>Options</GameButton>
        </div>
        <nav className="menu-panel__log" aria-label="Captain's log">
          <GameButton variant="secondary" size="small" onClick={() => onNavigate('ranking')}>
            Ranking
          </GameButton>
          <GameButton variant="secondary" size="small" onClick={() => onNavigate('history')}>
            Match History
          </GameButton>
        </nav>
        {pending.length > 0 && (
          <p className="menu-panel__pending" role="status">
            {pending.length === 1 ? '1 battle waiting to be logged.' : `${pending.length} battles waiting to be logged.`}{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                click();
                for (const item of pending) submitMatch(item.submission);
              }}
            >
              Retry now
            </button>
          </p>
        )}
        <ControlsReference />
      </section>
    </main>
  );
}
