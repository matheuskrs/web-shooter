import { useEffect, useRef } from 'react';
import { useServices } from '../../app/services';
import type { GameUiStore } from '../../game/bridge/GameUiStore';
import type { GameConfig } from '../../game/config/gameConfig';
import { GameSession, type MatchOutcome } from '../../game/core/GameSession';
import type { InputState } from '../../game/input/InputState';
import { trackSession } from '../../game/testing/testApi';

interface GameCanvasProps {
  config: GameConfig;
  seed: number;
  input: InputState;
  store: GameUiStore;
  manualClock: boolean;
  onEnded: (outcome: MatchOutcome) => void;
  onSession: (session: GameSession | null) => void;
}

/**
 * The single seam between React and Pixi: it gives the session a DOM node
 * and ties the session's lifetime to this component's mount. Everything
 * that changes per frame stays inside the session.
 */
export function GameCanvas({ config, seed, input, store, manualClock, onEnded, onSession }: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { audio, assets } = useServices();
  const callbacks = useRef({ onEnded, onSession });

  useEffect(() => {
    callbacks.current = { onEnded, onSession };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const session = new GameSession({
      config,
      seed,
      input,
      store,
      audio,
      textures: assets.textures,
      manualClock,
      onEnded: (outcome) => callbacks.current.onEnded(outcome),
    });
    const untrack = trackSession(session);
    void session.mount(host);
    callbacks.current.onSession(session);
    return () => {
      callbacks.current.onSession(null);
      session.dispose();
      untrack();
    };
  }, [config, seed, input, store, audio, assets, manualClock]);

  return <div ref={hostRef} className="game-canvas" />;
}
