import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useServices } from '../../app/services';
import { Dialog } from '../../components/Dialog';
import { GameButton } from '../../components/GameButton';
import { GameUiStore } from '../../game/bridge/GameUiStore';
import type { GameConfig, PlayerGameOptions } from '../../game/config/gameConfig';
import type { GameSession, MatchOutcome } from '../../game/core/GameSession';
import { InputState } from '../../game/input/InputState';
import { useMediaQuery, useTouchControlsWanted } from '../../hooks/useMediaQuery';
import { BattleAnnouncer } from './BattleAnnouncer';
import { BattleHud } from './BattleHud';
import { GameCanvas } from './GameCanvas';
import { LoadingOverlay } from './LoadingOverlay';
import { PerfOverlay } from './PerfOverlay';
import { perfModeEnabled } from '../../game/diagnostics/diagnostics';
import { TouchControls } from './TouchControls';
import './battle.css';

export interface MatchSetup {
  matchId: string;
  seed: number;
  /** The Options values this match was started with. */
  options: PlayerGameOptions;
  config: GameConfig;
}

interface BattleScreenProps {
  match: MatchSetup;
  manualClock: boolean;
  /** The match is over; called immediately so the result is saved even if the page closes. */
  onEnded: (outcome: MatchOutcome) => void;
  /** The closing explosion has played out; time to show the result. */
  onFinished: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** Lets the final explosion and sinking play before the result screen appears. */
const RESULT_DELAY_MS = 1800;

export function BattleScreen({ match, manualClock, onEnded, onFinished, onRestart, onQuit }: BattleScreenProps) {
  const { assets } = useServices();
  const loader = useSyncExternalStore(assets.subscribe, assets.getState);
  const [store] = useState(() => new GameUiStore());
  const [input] = useState(() => new InputState());
  const [session, setSession] = useState<GameSession | null>(null);
  const hud = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const touchWanted = useTouchControlsWanted();
  const portraitTouch = useMediaQuery('(orientation: portrait) and (pointer: coarse)');

  useEffect(() => {
    void assets.load();
  }, [assets]);

  useEffect(() => {
    if (portraitTouch) session?.pause('manual');
  }, [portraitTouch, session]);

  useEffect(() => {
    if (hud.phase !== 'ended') return;
    const timer = window.setTimeout(onFinished, manualClock ? 0 : RESULT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hud.phase, onFinished, manualClock]);

  const handleEnded = useCallback((outcome: MatchOutcome) => onEnded(outcome), [onEnded]);

  return (
    <main className={`battle${hud.phase === 'ended' ? ' battle--ended' : ''}`} aria-label="Battle">
      <h1 className="visually-hidden">Pirate Battle</h1>
      {loader.status === 'ready' ? (
        <>
          <GameCanvas
            config={match.config}
            seed={match.seed}
            input={input}
            store={store}
            manualClock={manualClock}
            onEnded={handleEnded}
            onSession={setSession}
          />
          <BattleHud store={store} onPause={() => session?.pause('manual')} />
          {touchWanted && <TouchControls input={input} disabled={hud.phase !== 'running'} />}
          <BattleAnnouncer store={store} />
          {perfModeEnabled && <PerfOverlay session={session} />}
        </>
      ) : (
        <LoadingOverlay state={loader} onRetry={() => void assets.load()} onQuit={onQuit} />
      )}

      <Dialog open={hud.phase === 'paused'} labelledBy="pause-title" onCancel={() => session?.resume()}>
        <h2 id="pause-title" className="panel__title">
          Paused
        </h2>
        {hud.pauseReason === 'focus-lost' && <p className="dialog__note">The battle waits while you are away.</p>}
        <div className="dialog__actions">
          <GameButton autoFocus onClick={() => session?.resume()}>
            Resume
          </GameButton>
          <GameButton onClick={onRestart}>Restart</GameButton>
          <GameButton variant="secondary" onClick={onQuit}>
            Main Menu
          </GameButton>
        </div>
      </Dialog>

      {portraitTouch && (
        <div className="rotate-hint" role="alert">
          <img src={rotateShip} alt="" width={66} height={113} />
          <p>Turn your device sideways to sail.</p>
        </div>
      )}
    </main>
  );
}

const rotateShip = new URL('../../../assets/png/default/ships/ship_3.png', import.meta.url).href;
