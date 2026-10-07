import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', listener);
      return () => list.removeEventListener('change', listener);
    },
    () => window.matchMedia(query).matches,
  );
}

/** Touch controls appear on coarse pointers (phones, tablets), not on desktop. */
export function useTouchControlsWanted(): boolean {
  const coarse = useMediaQuery('(pointer: coarse)');
  const forced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('touch');
  return coarse || forced;
}
