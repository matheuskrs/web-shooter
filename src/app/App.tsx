import { useCallback, useEffect, useRef, useState } from 'react';
import { useSubmitMatch } from '../api/queries';
import type { MatchOutcome } from '../game/core/GameSession';
import { readTestOverrides } from '../game/testing/testApi';
import { BattleScreen, type MatchSetup } from '../screens/battle/BattleScreen';
import { MainMenuScreen } from '../screens/menu/MainMenuScreen';
import { OptionsScreen } from '../screens/options/OptionsScreen';
import { ResultScreen } from '../screens/result/ResultScreen';
import { addPendingMatch, getPlayerId, lastResultStore, pendingMatchesStore } from '../storage/matchStorage';
import { gameOptionsOf, preferencesStore } from '../storage/preferences';
import { useStoredValue } from '../storage/storedValue';
import { buildSubmission, createMatch } from './matchFlow';
import { navigate, useRoute } from './navigation';
import { useServices } from './services';

const testOverrides = readTestOverrides();

export function App() {
  const route = useRoute();
  const { audio } = useServices();
  const preferences = useStoredValue(preferencesStore);
  const [match, setMatch] = useState<MatchSetup | null>(null);
  const submitMatch = useSubmitMatch();
  const recovered = useRef(false);

  useEffect(() => audio.setMuted(preferences.muted), [audio, preferences.muted]);

  // Matches that finished while the service was down (or before a refresh) are retried once on start.
  useEffect(() => {
    if (recovered.current) return;
    recovered.current = true;
    for (const pending of pendingMatchesStore.get()) submitMatch(pending.submission);
  }, [submitMatch]);

  const startBattle = useCallback(() => {
    audio.unlock();
    setMatch(createMatch(gameOptionsOf(preferencesStore.get()), testOverrides.seed));
    navigate('battle');
  }, [audio]);

  const quitToMenu = useCallback(() => {
    audio.play('ui_back', { volume: 0.5 });
    setMatch(null);
    navigate('menu');
  }, [audio]);

  const handleEnded = useCallback(
    (outcome: MatchOutcome) => {
      if (!match) return;
      const submission = buildSubmission(
        match,
        outcome,
        { playerId: getPlayerId(), playerName: preferencesStore.get().captainName },
        new Date(),
      );
      // Persist first: if the tab closes now, the result and the pending upload survive.
      lastResultStore.set({ submission, confirmed: false });
      addPendingMatch(submission);
      submitMatch(submission);
    },
    [match, submitMatch],
  );

  const showResult = useCallback(() => {
    setMatch(null);
    navigate('result', { replace: true });
  }, []);

  useEffect(() => {
    if (route === 'battle' && !match) navigate('menu', { replace: true });
  }, [route, match]);

  switch (route) {
    case 'battle':
      return match ? (
        <BattleScreen
          key={match.matchId}
          match={match}
          manualClock={testOverrides.manualClock}
          onEnded={handleEnded}
          onFinished={showResult}
          onRestart={startBattle}
          onQuit={quitToMenu}
        />
      ) : null;
    case 'options':
      return <OptionsScreen onBack={() => navigate('menu')} />;
    case 'result':
      return <ResultScreen onPlayAgain={startBattle} onMenu={() => navigate('menu')} />;
    case 'menu':
    default:
      return <MainMenuScreen onPlay={startBattle} onOptions={() => navigate('options')} />;
  }
}
