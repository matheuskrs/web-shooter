import { GameButton } from '../../components/GameButton';
import type { LoaderState } from '../../game/assets/AssetLoader';

const titleUrl = new URL('../../../assets/png/retina/ui/menu/title_pirate_battle.png', import.meta.url).href;

export function LoadingOverlay({ state, onRetry, onQuit }: { state: LoaderState; onRetry: () => void; onQuit: () => void }) {
  const percent = Math.round(state.progress * 100);
  const failed = state.status === 'error';
  return (
    <div className="loading">
      <img className="loading__title" src={titleUrl} alt="" width={384} height={128} />
      {failed ? (
        <div className="loading__error" role="alert">
          <p>The fleet could not be loaded. Check your connection and try again.</p>
          <div className="loading__actions">
            <GameButton onClick={onRetry}>Retry</GameButton>
            <GameButton variant="secondary" onClick={onQuit}>
              Main Menu
            </GameButton>
          </div>
        </div>
      ) : (
        <div
          className="hud-health-bar loading__bar"
          data-tone="amber"
          role="progressbar"
          aria-label="Loading battle"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="hud-health-bar__fill" style={{ ['--ratio' as string]: state.progress }} />
          <span className="hud-health-bar__text">{percent}%</span>
        </div>
      )}
    </div>
  );
}
