import { useEffect, useState, useSyncExternalStore } from 'react';
import { useServices } from '../../app/services';
import { GameUiStore } from '../../game/bridge/GameUiStore';
import type { GameConfig } from '../../game/config/gameConfig';
import type { GameSession, MatchOutcome } from '../../game/core/GameSession';
import { InputState } from '../../game/input/InputState';
import { GameCanvas } from './GameCanvas';

export interface MatchSetup {
  matchId: string;
  seed: number;
  config: GameConfig;
}

interface BattleScreenProps {
  match: MatchSetup;
  manualClock: boolean;
  onEnded: (outcome: MatchOutcome) => void;
}

export function BattleScreen({ match, manualClock, onEnded }: BattleScreenProps) {
  const { assets } = useServices();
  const loader = useSyncExternalStore(assets.subscribe, assets.getState);
  const [store] = useState(() => new GameUiStore());
  const [input] = useState(() => new InputState());
  const [, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    void assets.load();
  }, [assets]);

  return (
    <main className="battle">
      {loader.status === 'ready' ? (
        <GameCanvas
          config={match.config}
          seed={match.seed}
          input={input}
          store={store}
          manualClock={manualClock}
          onEnded={onEnded}
          onSession={setSession}
        />
      ) : (
        <p>{loader.status === 'error' ? loader.error : `${Math.round(loader.progress * 100)}%`}</p>
      )}
    </main>
  );
}
