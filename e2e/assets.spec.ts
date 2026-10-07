import { expect, test } from '@playwright/test';
import { openApp } from './support';

// The mock API service worker would serve asset requests itself and hide them
// from page.route, so this file runs without it. That also proves the game
// still works when the mock API cannot start.
test.use({ serviceWorkers: 'block' });

test.describe('Asset loading', () => {
  test('shows progress, reports a failure and recovers on retry', async ({ page }) => {
    let failShips = true;
    await page.route('**/ships_miscellaneous_sheet*.png', (route) => (failShips ? route.abort('failed') : route.continue()));

    await openApp(page);
    await page.getByRole('button', { name: 'Play', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText('could not be loaded');
    await expect(page.locator('canvas')).toHaveCount(0);

    failShips = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await page.waitForFunction(() => window.__pirateBattle?.isReady() === true);
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('displays a progress bar while the battle assets load', async ({ page }) => {
    await page.route('**/tiles_sheet_retina*.png', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await openApp(page);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('progressbar', { name: 'Loading battle' })).toBeVisible();
    await page.waitForFunction(() => window.__pirateBattle?.isReady() === true);
    await expect(page.getByRole('progressbar')).toHaveCount(0);
  });

  test('menus and options stay usable when the mock API is unavailable', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('alert')).toContainText("Couldn't load the log", { timeout: 15_000 });
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
  });
});
