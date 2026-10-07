import { expect, test } from '@playwright/test';
import { advance, holdKey, quietBattle, setPlayerPose, state } from './support';

test.describe('Movement and collisions', () => {
  test.beforeEach(async ({ page }) => {
    await quietBattle(page);
  });

  test('a battle starts with a full-health ship and the configured clock', async ({ page }) => {
    const snapshot = await state(page);
    expect(snapshot.phase).toBe('running');
    expect(snapshot.player.health).toBe(snapshot.player.maxHealth);
    expect(snapshot.remainingSeconds).toBe(120);
    await expect(page.getByRole('group', { name: 'Time left 120 seconds' })).toBeVisible();
  });

  test('W sails forward along the heading and stops when released', async ({ page }) => {
    const before = await state(page);
    await holdKey(page, 'KeyW', 1);
    const moving = await state(page);
    expect(moving.player.x - before.player.x).toBeGreaterThan(150);
    expect(Math.abs(moving.player.y - before.player.y)).toBeLessThan(1);

    await advance(page, 1.5);
    const coasted = await state(page);
    expect(coasted.player.speed).toBe(0);
  });

  test('A and D rotate the ship in both directions', async ({ page }) => {
    await holdKey(page, 'KeyD', 0.5);
    const right = await state(page);
    expect(right.player.heading).toBeGreaterThan(0.5);

    await holdKey(page, 'KeyA', 1);
    const left = await state(page);
    expect(left.player.heading).toBeLessThan(-0.3);
  });

  test('arrow keys mirror WASD', async ({ page }) => {
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down('ArrowRight');
    await advance(page, 0.5);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('ArrowUp');
    const snapshot = await state(page);
    expect(snapshot.player.speed).toBeGreaterThan(0);
    expect(snapshot.player.heading).toBeGreaterThan(0);
  });

  test('the hull never leaves the visible arena', async ({ page }) => {
    await setPlayerPose(page, 1450, 450, 0);
    await holdKey(page, 'KeyW', 3);
    const east = await state(page);
    expect(east.player.x + 32 + 20).toBeLessThanOrEqual(east.arena.width + 0.5);

    await setPlayerPose(page, 800, 150, -Math.PI / 2);
    await holdKey(page, 'KeyW', 3);
    const north = await state(page);
    expect(north.player.y - 32 - 20).toBeGreaterThanOrEqual(-0.5);
  });

  test('islands block the ship', async ({ page }) => {
    // The north-east sand island spans x 1088..1344, y 64..256.
    await setPlayerPose(page, 960, 160, 0);
    await holdKey(page, 'KeyW', 3);
    const blocked = await state(page);
    expect(blocked.player.x + 32 + 20).toBeLessThanOrEqual(1090 + 0.5);
    expect(blocked.player.x).toBeGreaterThan(1000);
  });

  test('a glancing contact slides along the shore instead of sticking', async ({ page }) => {
    await setPlayerPose(page, 960, 120, 0.35);
    await holdKey(page, 'KeyW', 2.5);
    const sliding = await state(page);
    expect(sliding.player.y).toBeGreaterThan(220);
  });
});
