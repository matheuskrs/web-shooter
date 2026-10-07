import { useSyncExternalStore } from 'react';

export type Route = 'menu' | 'options' | 'battle' | 'result';

const ROUTE_HASH: Readonly<Record<Route, string>> = {
  menu: '#/',
  options: '#/options',
  battle: '#/battle',
  result: '#/result',
};

function parseRoute(hash: string): Route {
  const match = (Object.entries(ROUTE_HASH) as [Route, string][]).find(([, value]) => value === hash);
  return match?.[0] ?? 'menu';
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

/**
 * Hash routing keeps the back button and refresh meaningful without a
 * router dependency. Four screens do not need more than this.
 */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseRoute(window.location.hash));
}

export function navigate(route: Route, { replace = false } = {}): void {
  const hash = ROUTE_HASH[route];
  if (window.location.hash === hash) return;
  if (replace) {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

/**
 * A battle cannot survive a reload: reloading on the battle screen abandons
 * the match and lands on the menu instead of silently starting a new one.
 */
export function abandonBattleRouteOnLoad(): void {
  if (parseRoute(window.location.hash) === 'battle') window.history.replaceState(null, '', ROUTE_HASH.menu);
}
