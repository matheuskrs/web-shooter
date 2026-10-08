import { expect, test, type Page } from '@playwright/test';
import { chooseScenario, openApp, openLog, toast } from './support';

const rows = (page: Page) => page.getByRole('tabpanel').locator('tbody tr:not(.log-table__skeleton)');
const skeletonRows = (page: Page) => page.getByRole('tabpanel').locator('tbody tr.log-table__skeleton');

test.describe("Captain's log", () => {
  test('ranking is paginated and ordered by score', async ({ page }) => {
    await openApp(page);
    await openLog(page, 'Ranking');
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('Page 1 of 3')).toBeVisible();
    await expect(rows(page)).toHaveCount(5);
    await expect(rows(page).first().locator('td').first()).toHaveText('01');

    const scores = (await rows(page).locator('td:nth-child(3)').allInnerTexts()).map(Number);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(panel.getByText('Page 2 of 3')).toBeVisible();
    await expect(rows(page).first().locator('td').first()).toHaveText('06');
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(panel.getByText('Page 1 of 3')).toBeVisible();
  });

  test('tabs are reachable from the menu and work with the keyboard', async ({ page }) => {
    await openApp(page);
    await openLog(page, 'Ranking');
    await expect(page.getByRole('tab', { name: 'Ranking' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Match History' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Match History' })).toBeFocused();
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });

  test('shows row-shaped skeletons while the first page loads', async ({ page }) => {
    await openApp(page, { scenario: 'slow' });
    await openLog(page, 'Ranking');
    await expect(skeletonRows(page)).toHaveCount(5);
    await expect(rows(page)).toHaveCount(5, { timeout: 6_000 });
    await expect(skeletonRows(page)).toHaveCount(0);
    await expect(page.getByText('Updating')).toHaveCount(0);
  });

  test('a background refresh keeps the rows on screen', async ({ page }) => {
    await openApp(page);
    await openLog(page, 'Ranking');
    await expect(rows(page)).toHaveCount(5);
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await chooseScenario(page, 'Slow network');
    // Returning to the tab revalidates in the background (2 s latency); cached rows stay visible.
    await openLog(page, 'Ranking');
    await expect(rows(page)).toHaveCount(5);
    await expect(skeletonRows(page)).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(rows(page)).toHaveCount(5);
  });

  test('shows empty states', async ({ page }) => {
    await openApp(page, { scenario: 'empty' });
    await openLog(page, 'Ranking');
    await expect(page.getByText('No battles logged for this setup yet.')).toBeVisible();
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByText('No battles yet.')).toBeVisible();
  });

  test('a ranking failure raises a toast, offers Retry and recovers; history still works', async ({ page }) => {
    await openApp(page, { scenario: 'ranking-failure' });
    await openLog(page, 'Ranking');
    const message = toast(page, "Couldn't load the ranking. Try again.");
    await expect(message).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('The log is out of reach right now.')).toBeVisible();
    // No raw technical errors on screen.
    await expect(page.getByText(/status code|Request failed|500/)).toHaveCount(0);

    // Bottom-centre placement.
    const box = await message.boundingBox();
    const viewport = page.viewportSize()!;
    expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(4);
    expect(box!.y + box!.height).toBeGreaterThan(viewport.height * 0.8);

    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByText('No battles yet.')).toBeVisible();

    await page.getByRole('button', { name: 'Main Menu' }).click();
    await chooseScenario(page, 'Success');
    await openLog(page, 'Ranking');
    const retry = page.getByRole('button', { name: 'Retry' });
    if (await retry.isVisible()) await retry.click();
    await expect(rows(page)).toHaveCount(5);
  });

  test('repeated failures update one toast instead of stacking', async ({ page }) => {
    await openApp(page, { scenario: 'http-500' });
    await openLog(page, 'Ranking');
    await expect(toast(page, "Couldn't load the ranking. Try again.")).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Retry' }).click();
    await page.waitForTimeout(1200);
    await expect(page.locator('.pirate-toast')).toHaveCount(1);
  });

  for (const [scenario, text] of [
    ['http-400', "Couldn't load the ranking. Try again."],
    ['connection-error', 'Connection unavailable.'],
    ['timeout', "Couldn't load the ranking. Try again."],
  ] as const) {
    test(`reports ${scenario} failures without technical details`, async ({ page }) => {
      await openApp(page, { scenario });
      await openLog(page, 'Ranking');
      await expect(toast(page, text)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    });
  }

  test('a history failure is reported for history', async ({ page }) => {
    await openApp(page, { scenario: 'history-failure' });
    await openLog(page, 'Match History');
    await expect(toast(page, "Couldn't load match history. Try again.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
