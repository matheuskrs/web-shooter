import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameUiStore, HudState } from '../../game/bridge/GameUiStore';

const LOW_HEALTH_RATIO = 0.3;
const ANNOUNCED_SECONDS = new Set([60, 30, 10]);

function describeChange(previous: HudState, next: HudState): string | null {
  if (next.phase !== previous.phase) {
    if (next.phase === 'running' && previous.phase === 'starting') return 'Battle started.';
    if (next.phase === 'paused') return 'Game paused.';
    if (next.phase === 'running') return 'Game resumed.';
    if (next.phase === 'ended') return next.endReason === 'defeated' ? 'Your ship sank. Battle over.' : 'Time is up. Battle over.';
  }
  if (next.score > previous.score) return `Enemy sunk. Score ${next.score}.`;
  const wasLow = previous.maxHealth > 0 && previous.health / previous.maxHealth <= LOW_HEALTH_RATIO;
  const isLow = next.maxHealth > 0 && next.health / next.maxHealth <= LOW_HEALTH_RATIO;
  if (isLow && !wasLow && next.health > 0) return `Health low: ${next.health}.`;
  if (next.secondsLeft !== previous.secondsLeft && ANNOUNCED_SECONDS.has(next.secondsLeft) && next.phase === 'running') {
    return `${next.secondsLeft} seconds left.`;
  }
  return null;
}

/**
 * Polite live region for screen readers. It only speaks on meaningful
 * moments (score, low health, a few time marks, pause and end), never on
 * every timer tick.
 */
export function BattleAnnouncer({ store }: { store: GameUiStore }) {
  const hud = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const previous = useRef(hud);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const text = describeChange(previous.current, hud);
    previous.current = hud;
    if (text) setMessage(text);
  }, [hud]);

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
