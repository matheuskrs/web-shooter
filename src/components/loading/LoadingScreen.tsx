import type { CSSProperties } from 'react';
import type { LoaderState } from '../../game/assets/AssetLoader';
import { GameButton } from '../GameButton';
import './loading.css';

const WORD = 'Loading';

interface LoadingScreenProps {
  state: LoaderState;
  /** Assets are ready: fade out, then `onGone` unmounts the screen. */
  done: boolean;
  onRetry: () => void;
  onGone: () => void;
}

/**
 * Shown until the shared textures are loaded. The wave and the
 * "." → ".." → "..." cycle are CSS animations, so nothing re-renders per frame;
 * React only renders again when the progress value changes.
 */
export function LoadingScreen({ state, done, onRetry, onGone }: LoadingScreenProps) {
  const failed = state.status === 'error';
  const percent = Math.round(state.progress * 100);
  const letters = [...WORD, '.', '.', '.'];

  return (
    <div
      className={`loading-screen${done ? ' loading-screen--done' : ''}`}
      aria-hidden={done || undefined}
      onTransitionEnd={(event) => {
        if (done && event.target === event.currentTarget) onGone();
      }}
    >
      {failed ? (
        <div className="loading-screen__error" role="alert">
          <p>The fleet could not be loaded. Check your connection and try again.</p>
          <GameButton onClick={onRetry}>Retry</GameButton>
        </div>
      ) : (
        <p
          className="loading-screen__word"
          role="progressbar"
          aria-label="Loading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          {letters.map((letter, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={index >= WORD.length ? `loading-screen__dot loading-screen__dot--${index - WORD.length + 1}` : undefined}
              style={{ '--i': index } as CSSProperties}
            >
              {letter}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
