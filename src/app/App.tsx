import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSubmitMatch } from '../api/queries';
import { PirateToaster } from '../components/toast/PirateToaster';
import { AnchoredScreen } from '../components/AnchoredScreen';
import { WorldCanvas } from '../components/WorldCanvas';
import type { MatchOutcome } from '../game/core/GameSession';
import { readTestOverrides } from '../game/testing/testApi';
import type { WorldLocation } from '../game/world/attractLayout';
import type { MatchSetup } from '../game/world/WorldHost';
import { BattleScreen } from '../screens/battle/BattleScreen';
import { CaptainsLogScreen } from '../screens/log/CaptainsLogScreen';
import { MainMenuScreen } from '../screens/menu/MainMenuScreen';
import { OptionsScreen } from '../screens/options/OptionsScreen';
import { ResultScreen } from '../screens/result/ResultScreen';
import { addPendingMatch, getPlayerId, lastResultStore, pendingMatchesStore } from '../storage/matchStorage';
import { gameOptionsOf, preferencesStore } from '../storage/preferences';
import { useStoredValue } from '../storage/storedValue';
import { buildSubmission, createMatch } from './matchFlow';
import { navigate, useNavigation, type Route } from './navigation';
import { useServices } from './services';

const testOverrides = readTestOverrides();

/** Each screen is a viewpoint in the same sea; battle and result look at the arena. */
const LOCATION_OF: Readonly<Record<Route, WorldLocation>> = {
  menu: 'menu',
  options: 'options',
  // Switching between the two log tabs is not a journey: same place, no camera move.
  ranking: 'log',
  history: 'log',
  battle: 'arena',
  result: 'arena',
};

/** Screens that exist at a place in the world; the battle HUD is screen-fixed instead. */
function isAnchored(route: Route): boolean {
  return route !== 'battle';
}

export function App() {
  const { route, previous, visit } = useNavigation();
  const { audio, assets, world } = useServices();
  const travelling = useSyncExternalStore(world.subscribe, world.getTravelling);
  const loader = useSyncExternalStore(assets.subscribe, assets.getState);
  const runtime = useSyncExternalStore(world.subscribe, world.getRuntime);
  const preferences = useStoredValue(preferencesStore);
  const [match, setMatch] = useState<MatchSetup | null>(null);
  const submitMatch = useSubmitMatch();
  const recovered = useRef(false);

  useEffect(() => audio.setMuted(preferences.muted), [audio, preferences.muted]);

  // Battle assets load at start-up: the menu's living sea needs them too.
  useEffect(() => {
    void assets.load();
  }, [assets]);

  useEffect(() => {
    if (loader.status === 'ready') world.ensureAttract();
  }, [loader.status, world]);

  // Matches that finished while the service was down (or before a refresh) are retried once on start.
  useEffect(() => {
    if (recovered.current) return;
    recovered.current = true;
    for (const pending of pendingMatchesStore.get()) submitMatch(pending.submission, { quiet: true });
  }, [submitMatch]);

  const recordResult = useCallback(
    (finished: MatchSetup, outcome: MatchOutcome) => {
      const submission = buildSubmission(
        finished,
        outcome,
        { playerId: getPlayerId(), playerName: preferencesStore.get().captainName },
        new Date(),
      );
      // Persist first: if the tab closes now, the result and the pending upload survive.
      lastResultStore.set({ submission, confirmed: false });
      addPendingMatch(submission);
      submitMatch(submission);
    },
    [submitMatch],
  );

  // Keep the camera on the current screen's location, including after
  // back/forward navigation. Idempotent, so Strict Mode's re-run is harmless.
  useEffect(() => {
    world.focus(LOCATION_OF[route]);
  }, [route, world]);

  // A battle requested before the assets were ready starts as soon as they are.
  useEffect(() => {
    if (route === 'battle' && match && loader.status === 'ready') {
      world.startMatch(match, (outcome) => recordResult(match, outcome));
    }
  }, [route, match, loader.status, world, recordResult]);

  // Nothing to show on the battle route (refresh, or history leading back to a finished match).
  useEffect(() => {
    if (route !== 'battle' || runtime) return;
    if (!match || world.hasPlayed(match.matchId)) navigate('menu', { replace: true });
  }, [route, match, runtime, world]);

  /** The camera starts flying now; the destination screen is already waiting at its spot in the world. */
  const go = useCallback(
    (target: Route) => {
      world.focus(LOCATION_OF[target]);
      navigate(target);
    },
    [world],
  );

  const startBattle = useCallback(() => {
    audio.unlock();
    const next = createMatch(gameOptionsOf(preferencesStore.get()), testOverrides.seed);
    setMatch(next);
    world.startMatch(next, (outcome) => recordResult(next, outcome));
    go('battle');
  }, [audio, world, recordResult, go]);

  const quitToMenu = useCallback(() => {
    audio.play('ui_back', { volume: 0.5 });
    setMatch(null);
    go('menu');
  }, [audio, go]);

  const showResult = useCallback(() => {
    setMatch(null);
    navigate('result', { replace: true });
  }, []);

  const renderScreen = (screen: Route) => {
    switch (screen) {
      case 'options':
        return <OptionsScreen onBack={() => go('menu')} />;
      case 'ranking':
      case 'history':
        return <CaptainsLogScreen tab={screen} onTab={go} onBack={() => go('menu')} />;
      case 'result':
        return <ResultScreen onPlayAgain={startBattle} onMenu={quitToMenu} />;
      case 'battle':
        return null;
      case 'menu':
      default:
        return <MainMenuScreen onPlay={startBattle} onNavigate={go} />;
    }
  };

  // The screen just left stays at its place while the camera flies away from it.
  // Exception: Play Again swoops into the arena where the result panel sits.
  const showPrevious =
    travelling && previous !== null && previous !== route && isAnchored(previous) && !(previous === 'result' && route === 'battle');

  return (
    <>
      <WorldCanvas />
      <div className="world-vignette" data-strong={route === 'result' || undefined} aria-hidden="true" hidden={route === 'battle'} />
      {showPrevious && (
        <AnchoredScreen key={`${previous}-${visit - 1}`} location={LOCATION_OF[previous]} active={false}>
          {renderScreen(previous)}
        </AnchoredScreen>
      )}
      {isAnchored(route) && (
        // Keyed by visit: every arrival starts fresh (unsaved Options are discarded, focus lands on the first control).
        <AnchoredScreen key={`${route}-${visit}`} location={LOCATION_OF[route]} active>
          {renderScreen(route)}
        </AnchoredScreen>
      )}
      {route === 'battle' && (
        <BattleScreen
          runtime={runtime}
          manualClock={testOverrides.manualClock}
          onFinished={showResult}
          onRestart={startBattle}
          onQuit={quitToMenu}
        />
      )}
      <PirateToaster />
    </>
  );
}
