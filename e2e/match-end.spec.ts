import { expect, test } from '@playwright/test';
import { advance, openApp, quietBattle, saveOptions, setAutoSpawn, spawnEnemy, startBattle, state } from './support';

test.describe('End of match', () => {
  test('time up stops the simulation and shows the result', async ({ page }) => {
    await openApp(page);
    await saveOptions(page, { session: '60' });
    await startBattle(page);
    await setAutoSpawn(page, false);
    await advance(page, 59.9);

    // Read the world on both sides of the end inside one call, before React leaves the battle.
    const [atEnd, later] = await page.evaluate(() => {
      const api = window.__pirateBattle!;
      api.advance(0.2);
      const first = api.getState();
      api.advance(5);
      return [first, api.getState()];
    });
    expect(atEnd?.phase).toBe('ended');
    expect(atEnd?.endReason).toBe('time_up');
    expect(atEnd?.elapsed).toBe(60);
    expect(later?.steps).toBe(atEnd?.steps);

    await expect(page.getByRole('heading', { name: 'Battle Complete' })).toBeVisible();
    await expect(page.getByText('01:00')).toBeVisible();
    await expect(page.getByText('Time up')).toBeVisible();
  });

  test('losing all health ends the match as defeated', async ({ page }) => {
    await quietBattle(page);
    for (let i = 0; i < 5; i++) {
      const snapshot = await state(page).catch(() => null);
      if (!snapshot || snapshot.phase !== 'running') break;
      await spawnEnemy(page, 'chaser', snapshot.player.x + 150, snapshot.player.y);
      await advance(page, 1.5);
    }
    await expect(page.getByRole('heading', { name: 'Ship Sunk' })).toBeVisible();
    await expect(page.getByText('Defeated')).toBeVisible();
    await expect(page.getByLabel('0 points')).toBeVisible();
  });

  test('play again starts a genuinely new match', async ({ page }) => {
    await quietBattle(page);
    const first = await state(page);
    await spawnEnemy(page, 'chaser', first.player.x + 250, first.player.y);
    await page.keyboard.down('Space');
    await advance(page, 1);
    await page.keyboard.up('Space');
    await spawnEnemy(page, 'chaser', first.player.x + 150, first.player.y);
    await advance(page, 1);
    const mid = await state(page);
    expect(mid.score).toBe(1);
    expect(mid.player.health).toBeLessThan(100);

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Restart' }).click();
    await page.waitForFunction(() => window.__pirateBattle?.isReady() === true);
    const fresh = await state(page);
    expect(fresh.score).toBe(0);
    expect(fresh.player.health).toBe(fresh.player.maxHealth);
    expect(fresh.elapsed).toBe(0);
    expect(fresh.enemies).toHaveLength(0);
    expect(fresh.projectiles).toHaveLength(0);
    expect(await page.locator('canvas').count()).toBe(1);
    const lifecycle = await page.evaluate(() => window.__pirateBattle!.lifecycle());
    expect(lifecycle.live).toBe(1);
  });
});
