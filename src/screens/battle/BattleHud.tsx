import { useSyncExternalStore } from 'react';
import { Icon } from '../../components/Icon';
import { RoundButton } from '../../components/RoundButton';
import type { GameUiStore } from '../../game/bridge/GameUiStore';
import { formatClock } from '../../utils/format';

function healthTone(ratio: number): 'green' | 'amber' | 'red' {
  if (ratio > 0.6) return 'green';
  if (ratio > 0.3) return 'amber';
  return 'red';
}

/**
 * Re-renders only when the store publishes a change: health or score
 * changes, or the displayed second ticks. Never per frame.
 */
export function BattleHud({ store, onPause }: { store: GameUiStore; onPause: () => void }) {
  const hud = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const ratio = hud.maxHealth > 0 ? hud.health / hud.maxHealth : 1;
  const urgent = hud.secondsLeft <= 10 && hud.phase === 'running';

  return (
    <header className="hud">
      <div className="hud__health" role="group" aria-label={`Health ${hud.health} of ${hud.maxHealth}`}>
        <Icon name="heart" size={36} className="hud__heart" />
        <div className="hud-health-bar" data-tone={healthTone(ratio)}>
          <div className="hud-health-bar__fill" style={{ ['--ratio' as string]: ratio }} />
          <span className="hud-health-bar__text" aria-hidden="true">
            {hud.health} / {hud.maxHealth}
          </span>
        </div>
      </div>

      <div className="hud__counters">
        <div className="hud-counter" role="group" aria-label={`Score ${hud.score}`}>
          <Icon name="score" size={26} />
          <span key={hud.score} className="hud-counter__value hud-counter__value--bump" aria-hidden="true">
            {hud.score}
          </span>
        </div>
        <div className={`hud-counter${urgent ? ' hud-counter--urgent' : ''}`} role="group" aria-label={`Time left ${hud.secondsLeft} seconds`}>
          <Icon name="time" size={26} />
          <span className="hud-counter__value" aria-hidden="true">
            {formatClock(hud.secondsLeft)}
          </span>
        </div>
        <RoundButton icon="pause" label="Pause" size={52} onClick={onPause} disabled={hud.phase !== 'running'} />
      </div>
    </header>
  );
}
