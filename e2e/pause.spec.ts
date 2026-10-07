import { expect, test } from '@playwright/test';
import { advance, openApp, quietBattle, startBattle, state } from './support';

test.describe('Pause', () => {
  test('Escape pauses; nothing advances and held input is discarded', async ({ page }) => {
    await quietBattle(page);
    await advance(page, 1);
    const before = await state(page);

    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused();

    // Input and time while paused must not carry over.
    await page.keyboard.down('KeyW');
    await page.keyboard.down('Space');
    await advance(page, 5);
    const paused = await state(page);
    expect(paused.remainingSeconds).toBe(before.remainingSeconds);
    expect(paused.steps).toBe(before.steps);

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(dialog).toBeHidden();
    await advance(page, 1);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('Space');
    const resumed = await state(page);
    expect(resumed.player.x).toBe(before.player.x);
    expect(resumed.projectiles).toHaveLength(0);
    expect(resumed.remainingSeconds).toBeCloseTo(before.remainingSeconds - 1, 5);
  });

  test('losing focus pauses automatically and needs an explicit resume', async ({ page }) => {
    await quietBattle(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    await expect(page.getByText('The battle waits while you are away.')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden();
  });

  test('hiding the tab pauses the match', async ({ page }) => {
    await quietBattle(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  });

  test('with the real clock, paused wall time does not reach the timer', async ({ page }) => {
    await openApp(page, { manualClock: false });
    await startBattle(page);
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Pause' }).click();
    const paused = await state(page);
    await page.waitForTimeout(1500);
    expect((await state(page)).elapsed).toBe(paused.elapsed);

    const resumedAt = Date.now();
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.waitForTimeout(1200);
    const resumed = await state(page);
    const wallSeconds = (Date.now() - resumedAt) / 1000;
    // Only wall time after the resume may reach the match clock (plus one capped frame).
    expect(resumed.elapsed - paused.elapsed).toBeGreaterThan(0.5);
    expect(resumed.elapsed - paused.elapsed).toBeLessThanOrEqual(wallSeconds + 0.1);
  });
});
