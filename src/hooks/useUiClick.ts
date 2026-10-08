import { useCallback } from 'react';
import { useServices } from '../app/services';

/**
 * The click sound for intentional UI actions (buttons, tabs, pagination).
 * Also unlocks audio, since a click is a valid user gesture.
 */
export function useUiClick(): () => void {
  const { audio } = useServices();
  return useCallback(() => {
    audio.unlock();
    // Fast double clicks play once instead of stacking into a rattle.
    audio.play('UI_Click_2', { volume: 0.6, minIntervalMs: 90 });
  }, [audio]);
}
