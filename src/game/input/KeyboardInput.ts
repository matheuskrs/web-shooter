import type { GameAction, InputState } from './InputState';

export const KEY_BINDINGS: Readonly<Record<string, GameAction>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',
  Space: 'fireFront',
  KeyQ: 'fireLeft',
  KeyE: 'fireRight',
};

const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

export interface KeyboardInputOptions {
  input: InputState;
  onPauseKey: () => void;
  /** Gameplay keys are only captured while this returns true. */
  isActive: () => boolean;
}

/**
 * Binds gameplay keys on window. Listeners are attached by `attach()` and
 * removed by `detach()`; the session owns that lifecycle.
 */
export class KeyboardInput {
  private attached = false;

  constructor(private readonly options: KeyboardInputOptions) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (PAUSE_KEYS.has(event.code)) {
      if (!event.repeat && this.options.isActive()) {
        event.preventDefault();
        this.options.onPauseKey();
      }
      return;
    }
    const action = KEY_BINDINGS[event.code];
    if (!action || !this.options.isActive()) return;
    event.preventDefault();
    this.options.input.press(action, `key:${event.code}`);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    this.options.input.release(action, `key:${event.code}`);
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
