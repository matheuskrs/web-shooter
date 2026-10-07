import { expect, test } from '@playwright/test';
import { advance, openApp, saveOptions, setAutoSpawn, setPlayerPose, spawnEnemy, startBattle } from './support';

test.describe('Visual regression', () => {
  test('main menu', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('tabpanel').locator('tbody tr')).toHaveCount(5);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('menu.png', { fullPage: true });
  });

  test('arena in a stable state', async ({ page }) => {
    await openApp(page);
    await startBattle(page);
    await setAutoSpawn(page, false);
    await setPlayerPose(page, 760, 420, -0.4);
    await spawnEnemy(page, 'shooter', 1250, 560);
    await spawnEnemy(page, 'chaser', 260, 520);
    await advance(page, 1);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('arena.png');
  });

  test('result screen', async ({ page }) => {
    await openApp(page);
    await saveOptions(page, { session: '60' });
    await startBattle(page);
    await setAutoSpawn(page, false);
    await advance(page, 61);
    await expect(page.getByText('Logged in the Captain’s Log.')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('result.png');
  });
});
