import { expect, test, type Page } from '@playwright/test';
import { openApp } from './support';

const rows = (page: Page) => page.getByRole('tabpanel').locator('tbody tr');

test.describe("Captain's log", () => {
  test('ranking is paginated and ordered by score', async ({ page }) => {
    await openApp(page);
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('Page 1 of 3')).toBeVisible();
    await expect(rows(page)).toHaveCount(5);
    await expect(rows(page).first().locator('td').first()).toHaveText('01');

    const scores = await rows(page).locator('td:nth-child(3)').allInnerTexts();
    const numeric = scores.map(Number);
    expect([...numeric].sort((a, b) => b - a)).toEqual(numeric);

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(panel.getByText('Page 2 of 3')).toBeVisible();
    await expect(rows(page).first().locator('td').first()).toHaveText('06');
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(panel.getByText('Page 1 of 3')).toBeVisible();
  });

  test('tabs work with the keyboard', async ({ page }) => {
    await openApp(page);
    await page.getByRole('tab', { name: 'Ranking' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Match History' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Match History' })).toBeFocused();
  });

  test('shows a loading state on slow networks', async ({ page }) => {
    await openApp(page, { scenario: 'slow' });
    await expect(page.getByText('Unrolling the charts…')).toBeVisible();
    await expect(rows(page)).toHaveCount(5, { timeout: 6_000 });
  });

  test('shows empty states', async ({ page }) => {
    await openApp(page, { scenario: 'empty' });
    await expect(page.getByText('No battles logged for this setup yet.')).toBeVisible();
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByText('No battles yet.')).toBeVisible();
  });

  test('a ranking failure shows an error with retry while history still works', async ({ page }) => {
    await openApp(page, { scenario: 'ranking-failure' });
    const error = page.getByRole('alert').filter({ hasText: "Couldn't load the log" });
    await expect(error).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(page.getByText('No battles yet.')).toBeVisible();

    // Recover by switching the mock back to success, then retry.
    await page.getByRole('button', { name: 'Options' }).click();
    await page.getByText('Network simulation').click();
    await page.getByLabel('Mock API scenario').selectOption('success');
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await page.getByRole('tab', { name: 'Ranking' }).click();
    const retry = page.getByRole('button', { name: 'Retry' });
    if (await retry.isVisible()) await retry.click();
    await expect(rows(page)).toHaveCount(5);
  });

  for (const scenario of ['http-500', 'http-400', 'connection-error', 'timeout', 'history-failure'] as const) {
    test(`reports ${scenario} failures`, async ({ page }) => {
      await openApp(page, { scenario });
      if (scenario === 'history-failure') await page.getByRole('tab', { name: 'Match History' }).click();
      await expect(page.getByRole('alert').filter({ hasText: "Couldn't load the log" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    });
  }
});
