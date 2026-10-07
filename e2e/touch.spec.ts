import { expect, test, type Page } from '@playwright/test';
import { advance, quietBattle, state } from './support';

test.skip(({ isMobile }) => !isMobile, 'Touch controls are only shown on coarse pointers');

async function centreOf(page: Page, label: string) {
  const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
  if (!box) throw new Error(`No button ${label}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('Touch controls', () => {
  test('the helm and the cannons are visible on touch devices only', async ({ page }) => {
    await quietBattle(page);
    await expect(page.getByTestId('touch-controls')).toBeVisible();
    for (const label of ['Turn left', 'Sail forward', 'Turn right', 'Fire port broadside', 'Fire bow cannon', 'Fire starboard broadside']) {
      const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
      // Large enough for a thumb.
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });

  test('two fingers sail and fire at the same time', async ({ page }) => {
    await quietBattle(page);
    const before = await state(page);
    const helm = await centreOf(page, 'Sail forward');
    const gun = await centreOf(page, 'Fire bow cannon');
    const cdp = await page.context().newCDPSession(page);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: helm.x, y: helm.y, id: 1 },
        { x: gun.x, y: gun.y, id: 2 },
      ],
    });
    await advance(page, 1);
    const during = await state(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    expect(during.player.x - before.player.x).toBeGreaterThan(120);
    expect(during.projectiles.filter((projectile) => projectile.slot === 'front').length).toBeGreaterThanOrEqual(2);

    await advance(page, 1.5);
    expect((await state(page)).player.speed).toBe(0);
  });

  test('turn and broadside buttons drive the real controls', async ({ page }) => {
    await quietBattle(page);
    const turn = await centreOf(page, 'Turn right');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: turn.x, y: turn.y, id: 3 }] });
    await advance(page, 0.5);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect((await state(page)).player.heading).toBeGreaterThan(0.4);

    const broadside = await centreOf(page, 'Fire starboard broadside');
    await page.touchscreen.tap(broadside.x, broadside.y);
    await advance(page, 1 / 30);
    expect((await state(page)).projectiles.filter((projectile) => projectile.slot === 'right')).toHaveLength(3);
  });
});
