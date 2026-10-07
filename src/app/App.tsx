import { useState } from 'react';
import { createMatchConfig } from '../game/config/gameConfig';
import { BattleScreen, type MatchSetup } from '../screens/battle/BattleScreen';
import { readTestOverrides } from '../game/testing/testApi';
import { gameOptionsOf, preferencesStore } from '../storage/preferences';

const testOverrides = readTestOverrides();

function createMatch(): MatchSetup {
  return {
    matchId: crypto.randomUUID(),
    seed: testOverrides.seed ?? crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
    config: createMatchConfig(gameOptionsOf(preferencesStore.get())),
  };
}

export function App() {
  const [match] = useState(createMatch);
  return <BattleScreen key={match.matchId} match={match} manualClock={testOverrides.manualClock} onEnded={() => undefined} />;
}
