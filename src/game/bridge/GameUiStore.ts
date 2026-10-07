import type { EndReason } from '../simulation/events';

export type GamePhase = 'starting' | 'running' | 'paused' | 'ended';
export type PauseReason = 'manual' | 'focus-lost';

export interface HudState {
  phase: GamePhase;
  pauseReason: PauseReason | null;
  health: number;
  maxHealth: number;
  score: number;
  /** Whole seconds, rounded up, so the display changes once per second. */
  secondsLeft: number;
  endReason: EndReason | null;
}

const INITIAL_STATE: HudState = {
  phase: 'starting',
  pauseReason: null,
  health: 0,
  maxHealth: 0,
  score: 0,
  secondsLeft: 0,
  endReason: null,
};

/**
 * The only channel from the game to React. The session writes discrete
 * values (score, health, displayed second, phase); listeners are notified
 * only when a value actually changes, so React renders a handful of times
 * per second at most, never once per frame.
 *
 * Shaped for `useSyncExternalStore`: stable `subscribe` and an immutable
 * snapshot replaced on change.
 */
export class GameUiStore {
  private state: HudState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): HudState => this.state;

  update(patch: Partial<HudState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof HudState)[]) {
      if (patch[key] !== this.state[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
