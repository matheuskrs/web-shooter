import { useEffect, useSyncExternalStore } from 'react';
import { useServices } from '../../app/services';
import { Dialog } from '../../components/Dialog';
import { GameButton } from '../../components/GameButton';
import { perfModeEnabled } from '../../game/diagnostics/diagnostics';
import type { MatchRuntime } from '../../game/world/WorldHost';
import { useMediaQuery, useTouchControlsWanted } from '../../hooks/useMediaQuery';
import { BattleAnnouncer } from './BattleAnnouncer';
import { BattleHud } from './BattleHud';
import { LoadingOverlay } from './LoadingOverlay';
import { PerfOverlay } from './PerfOverlay';
import { TouchControls } from './TouchControls';
import './battle.css';

interface BattleScreenProps {
  runtime: MatchRuntime | null;
  manualClock: boolean;
  /** The closing explosion has played out; time to show the result. */
  onFinished: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** Lets the final explosion and sinking play before the result screen appears. */
const RESULT_DELAY_MS = 1800;

const rotateShip = new URL('../../../assets/png/default/ships/ship_3.png', import.meta.url).href;

/**
 * Overlay for a running match: HUD, touch controls, pause dialog and the
 * screen-reader announcer. The arena itself is drawn by the shared world
 * canvas underneath; nothing here renders per frame.
 */
export function BattleScreen({ runtime, manualClock, onFinished, onRestart, onQuit }: BattleScreenProps) {
  const { assets } = useServices();
  const loader = useSyncExternalStore(assets.subscribe, assets.getState);

  if (!runtime) {
    return loader.status === 'ready' ? null : (
      <main className="battle" aria-label="Battle">
        <LoadingOverlay state={loader} onRetry={() => void assets.load()} onQuit={onQuit} />
      </main>
    );
  }
  return (
    <BattleOverlay
      key={runtime.matchId}
      runtime={runtime}
      manualClock={manualClock}
      onFinished={onFinished}
      onRestart={onRestart}
      onQuit={onQuit}
    />
  );
}

function BattleOverlay({ runtime, manualClock, onFinished, onRestart, onQuit }: BattleScreenProps & { runtime: MatchRuntime }) {
  const { store, input, session } = runtime;
  const hud = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const touchWanted = useTouchControlsWanted();
  const portraitTouch = useMediaQuery('(orientation: portrait) and (pointer: coarse)');
  const inControl = hud.phase !== 'starting';

  useEffect(() => {
    if (portraitTouch) session.pause('manual');
  }, [portraitTouch, session, hud.phase]);

  useEffect(() => {
    if (hud.phase !== 'ended') return;
    const timer = window.setTimeout(onFinished, manualClock ? 0 : RESULT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hud.phase, onFinished, manualClock]);

  return (
    <main className={`battle${hud.phase === 'ended' ? ' battle--ended' : ''}`} aria-label="Battle">
      <h1 className="visually-hidden">Pirate Battle</h1>
      {inControl && (
        <>
          <BattleHud store={store} onPause={() => session.pause('manual')} />
          {touchWanted && <TouchControls input={input} disabled={hud.phase !== 'running'} />}
        </>
      )}
      <BattleAnnouncer store={store} />
      {perfModeEnabled && <PerfOverlay session={session} />}

      <Dialog open={hud.phase === 'paused'} labelledBy="pause-title" onCancel={() => session.resume()}>
        <h2 id="pause-title" className="panel__title">
          Paused
        </h2>
        {hud.pauseReason === 'focus-lost' && <p className="dialog__note">The battle waits while you are away.</p>}
        <div className="dialog__actions">
          <GameButton autoFocus onClick={() => session.resume()}>
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
