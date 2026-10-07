export type GameAction = 'forward' | 'turnLeft' | 'turnRight' | 'fireFront' | 'fireLeft' | 'fireRight';

export const GAME_ACTIONS: readonly GameAction[] = [
  'forward',
  'turnLeft',
  'turnRight',
  'fireFront',
  'fireLeft',
  'fireRight',
];

/**
 * Device-agnostic input. Keyboard keys and touch pointers are "sources"; an
 * action is held while any source holds it, so W + ArrowUp, or a key plus a
 * finger, never cancel each other out.
 */
export class InputState {
  private readonly holders = new Map<GameAction, Set<string>>();
  /** Presses since the last simulation step, so a tap shorter than a frame is never lost. */
  private readonly pressedSinceStep = new Set<GameAction>();

  press(action: GameAction, source: string): void {
    let sources = this.holders.get(action);
    if (!sources) {
      sources = new Set();
      this.holders.set(action, sources);
    }
    if (sources.size === 0) this.pressedSinceStep.add(action);
    sources.add(source);
  }

  release(action: GameAction, source: string): void {
    this.holders.get(action)?.delete(source);
  }

  releaseSource(source: string): void {
    for (const sources of this.holders.values()) sources.delete(source);
  }

  isHeld(action: GameAction): boolean {
    return (this.holders.get(action)?.size ?? 0) > 0;
  }

  wasPressed(action: GameAction): boolean {
    return this.pressedSinceStep.has(action);
  }

  /** Called after each simulation step consumed the edges. */
  endStep(): void {
    this.pressedSinceStep.clear();
  }

  /** Forget everything, e.g. when pausing, so nothing carries over on resume. */
  clear(): void {
    this.holders.clear();
    this.pressedSinceStep.clear();
  }
}
