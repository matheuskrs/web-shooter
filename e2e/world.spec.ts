import { expect, test, type Page } from '@playwright/test';
import { lifecycle, openApp, openLog } from './support';

async function world(page: Page) {
  const probe = await page.evaluate(() => window.__pirateBattle?.world() ?? null);
  if (!probe) throw new Error('World probe unavailable');
  return probe;
}

test.describe('Living world and camera', () => {
  test('the menu sea is alive: fleets sail and the camera drifts', async ({ page }) => {
    await openApp(page, { manualClock: false });
    await expect.poll(async () => (await world(page)).attractShips).toBeGreaterThan(3);
    const before = await world(page);
    await page.waitForTimeout(2500);
    const after = await world(page);
    // Idle drift heads towards the top-left of the screen.
    expect(after.camera.x).toBeLessThan(before.camera.x);
    expect(after.camera.y).toBeLessThan(before.camera.y);
    expect(after.travelling).toBe(false);
  });

  test('the menu skirmish never counts as a match', async ({ page }) => {
    await openApp(page, { manualClock: false });
    await page.waitForTimeout(4000);
    expect(await lifecycle(page)).toEqual({ created: 0, disposed: 0, live: 0 });
    await openLog(page, 'Match History');
    await expect(page.getByText('No battles yet.')).toBeVisible();
  });

  test('menu navigation travels the camera to another place', async ({ page }) => {
    await openApp(page, { manualClock: false });
    const start = await world(page);
    await page.getByRole('button', { name: 'Ranking', exact: true }).click();
    await expect.poll(async () => (await world(page)).travelling).toBe(true);
    await expect.poll(async () => (await world(page)).travelling, { timeout: 4000 }).toBe(false);
    const arrived = await world(page);
    expect(Math.hypot(arrived.camera.x - start.camera.x, arrived.camera.y - start.camera.y)).toBeGreaterThan(1000);
    await expect(page.getByRole('tab', { name: 'Ranking' })).toBeFocused();
  });

  test('PLAY flies to the ship, then hands over control and the HUD', async ({ page }) => {
    await openApp(page, { manualClock: false });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    // Control is not handed over mid-flight.
    expect(await page.evaluate(() => window.__pirateBattle?.isReady() ?? false)).toBe(false);
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
    await page.waitForFunction(() => window.__pirateBattle?.isReady() === true, null, { timeout: 4000 });
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    const landed = await world(page);
    expect(landed.travelling).toBe(false);
    expect(landed.camera.zoom).toBeCloseTo(1, 5);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('navigation cuts instead of travelling and stays fully usable', async ({ page }) => {
      await openApp(page, { manualClock: false });
      await page.getByRole('button', { name: 'Ranking', exact: true }).click();
      await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveAttribute('aria-selected', 'true');
      expect((await world(page)).travelling).toBe(false);
      await page.getByRole('button', { name: 'Main Menu' }).click();
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.waitForFunction(() => window.__pirateBattle?.isReady() === true, null, { timeout: 1500 });
    });
  });
});
