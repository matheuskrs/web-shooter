import { expect, test, type Page } from '@playwright/test';
import { advance, lifecycle, openApp, openLog, saveOptions, setAutoSpawn, startBattle } from './support';

async function finishShortMatch(page: Page) {
  await saveOptions(page, { session: '60' });
  await startBattle(page);
  await setAutoSpawn(page, false);
  await advance(page, 61);
  await expect(page.getByRole('heading', { name: 'Battle Complete' })).toBeVisible();
}

test.describe('Result and navigation', () => {
  test('the result survives a refresh', async ({ page }) => {
    await openApp(page);
    await finishShortMatch(page);
    await expect(page.getByText('Logged in the Captain’s Log.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Battle Complete' })).toBeVisible();
    await expect(page.getByLabel('0 points')).toBeVisible();
    await expect(page.getByText('01:00')).toBeVisible();
    await expect(page.getByText('Logged in the Captain’s Log.')).toBeVisible();
  });

  test('refreshing during a battle abandons it without registering anything', async ({ page }) => {
    await openApp(page);
    await startBattle(page);
    await advance(page, 5);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await openLog(page, 'Match History');
    await expect(page.getByText('No battles yet.')).toBeVisible();
  });

  test('leaving a battle from the pause menu abandons it', async ({ page }) => {
    await openApp(page);
    await startBattle(page);
    await advance(page, 3);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await openLog(page, 'Match History');
    await expect(page.getByText('No battles yet.')).toBeVisible();
    expect(await lifecycle(page)).toEqual({ created: 1, disposed: 1, live: 0 });
  });

  test('repeated navigation between screens leaves no battle running', async ({ page }) => {
    await openApp(page);
    for (let round = 0; round < 3; round++) {
      await page.getByRole('button', { name: 'Options' }).click();
      await page.getByRole('button', { name: 'Main Menu' }).click();
      await startBattle(page);
      await advance(page, 1);
      await page.goBack();
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
      await expect.poll(async () => (await lifecycle(page)).live).toBe(0);
    }
    // One persistent world canvas; every match session was created and disposed.
    await expect(page.locator('canvas')).toHaveCount(1);
    expect(await lifecycle(page)).toEqual({ created: 3, disposed: 3, live: 0 });
  });
});
