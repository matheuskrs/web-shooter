import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { applyScenarioFromUrl } from './mockState';

/**
 * The deployed demo has no real backend, so the mock API runs in every
 * build, production included. If the service worker cannot start (old
 * browser, private mode restrictions), the app still runs; only ranking and
 * history show their error state.
 */
export async function startMockApi(): Promise<boolean> {
  applyScenarioFromUrl();
  try {
    await setupWorker(...handlers).start({
      onUnhandledFrame: 'bypass',
      quiet: true,
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
    return true;
  } catch {
    return false;
  }
}
