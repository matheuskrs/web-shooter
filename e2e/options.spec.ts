import { expect, test } from '@playwright/test';
import { openApp } from './support';

test.describe('Options', () => {
  test('validates, saves and keeps settings after a refresh', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();

    const session = page.getByLabel('Game session time', { exact: true });
    const spawn = page.getByLabel('Enemy spawn time', { exact: true });
    const save = page.getByRole('button', { name: 'Save' });

    await session.fill('45');
    await expect(session).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert').filter({ hasText: 'from 60 to 180' })).toBeVisible();
    await expect(save).toBeDisabled();

    await session.fill('90');
    await spawn.fill('0');
    await expect(page.getByRole('alert').filter({ hasText: '1 to 10 seconds' })).toBeVisible();
    await expect(save).toBeDisabled();
    await spawn.fill('2.3');
    await expect(save).toBeDisabled();

    await page.getByRole('button', { name: 'Increase enemy spawn time' }).click();
    await expect(spawn).toHaveValue('2.5');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
    await expect(page.getByLabel('Game session time', { exact: true })).toHaveValue('90');
    await expect(page.getByLabel('Enemy spawn time', { exact: true })).toHaveValue('2.5');
  });

  test('steppers respect the documented limits', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Options' }).click();
    const increase = page.getByRole('button', { name: 'Increase game session time' });
    for (let i = 0; i < 10; i++) await increase.click();
    await expect(page.getByLabel('Game session time', { exact: true })).toHaveValue('180');
  });

  test('unsaved changes are discarded when leaving', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Options' }).click();
    await page.getByLabel('Game session time', { exact: true }).fill('150');
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByLabel('Game session time', { exact: true })).toHaveValue('120');
  });
});
