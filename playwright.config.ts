import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

/**
 * E2E runs against an optimized build made with `--mode e2e`: the same
 * bundle shape as production (MSW included) plus the small test API and
 * shorter network timeouts. Tests drive the simulation with a manual clock
 * (`?clock=manual`) and fixed seeds so runs are reproducible.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Every test renders WebGL in software (SwiftShader); a few workers avoid CPU starvation.
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: {
    timeout: 7_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'UTC',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7 landscape'] },
      testMatch: /(navigation|touch|options|captains-log|match-flow|visual|world)\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
