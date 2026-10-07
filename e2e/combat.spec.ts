import { expect, test, type Page } from '@playwright/test';
import { advance, holdKey, quietBattle, spawnEnemy, state } from './support';

/** Samples the battle in small steps and returns every projectile id seen. */
async function projectilesSeen(page: Page, seconds: number, slot: string) {
  const ids = new Set<number>();
  for (let t = 0; t < seconds; t += 0.05) {
    await advance(page, 0.05);
    for (const projectile of (await state(page)).projectiles) if (projectile.slot === slot) ids.add(projectile.id);
  }
  return ids;
}

test.describe('Combat', () => {
  test.beforeEach(async ({ page }) => {
    await quietBattle(page);
  });

  test('Space fires a single bow ball that travels ahead of the ship', async ({ page }) => {
    await page.keyboard.press('Space');
    await advance(page, 1 / 60);
    const fired = await state(page);
    const balls = fired.projectiles.filter((projectile) => projectile.slot === 'front');
    expect(balls).toHaveLength(1);
    expect(balls[0]!.x).toBeGreaterThan(fired.player.x);
    expect(fired.cooldowns.front).toBeGreaterThan(0);

    await advance(page, 0.3);
    const later = await state(page);
    expect(later.projectiles[0]!.x).toBeGreaterThan(balls[0]!.x + 150);
  });

  test('Q and E fire three parallel balls to each side', async ({ page }) => {
    await page.keyboard.press('KeyQ');
    await page.keyboard.press('KeyE');
    await advance(page, 1 / 60);
    const fired = await state(page);
    const port = fired.projectiles.filter((projectile) => projectile.slot === 'left');
    const starboard = fired.projectiles.filter((projectile) => projectile.slot === 'right');
    expect(port).toHaveLength(3);
    expect(starboard).toHaveLength(3);
    // Heading east: port is north (smaller y), starboard south; balls spread along the keel.
    for (const ball of port) expect(ball.y).toBeLessThan(fired.player.y);
    for (const ball of starboard) expect(ball.y).toBeGreaterThan(fired.player.y);
    expect(new Set(port.map((ball) => Math.round(ball.x))).size).toBe(3);
  });

  test('holding fire respects the weapon cooldown', async ({ page }) => {
    await page.keyboard.down('Space');
    const shots = await projectilesSeen(page, 1, 'front');
    await page.keyboard.up('Space');
    // 0.32s cooldown at 60 steps per second: shots on steps 1, 21 and 41.
    expect(shots.size).toBe(3);

    await page.keyboard.down('KeyQ');
    const volleys = await projectilesSeen(page, 1.2, 'left');
    await page.keyboard.up('KeyQ');
    expect(volleys.size).toBe(3);
  });

  test('hits damage the enemy once per ball and a kill scores exactly one point', async ({ page }) => {
    const before = await state(page);
    const shooterId = await spawnEnemy(page, 'shooter', before.player.x + 380, before.player.y);
    await page.keyboard.press('Space');
    await advance(page, 0.8);
    const hit = await state(page);
    const shooter = hit.enemies.find((enemy) => enemy.id === shooterId)!;
    expect(shooter.health).toBe(shooter.maxHealth - 20);
    expect(hit.projectiles.filter((projectile) => projectile.team === 'player')).toHaveLength(0);

    await page.keyboard.down('Space');
    await advance(page, 1.6);
    await page.keyboard.up('Space');
    await advance(page, 1);
    const after = await state(page);
    expect(after.enemies.find((enemy) => enemy.id === shooterId)).toBeUndefined();
    expect(after.score).toBe(1);
    await expect(page.getByRole('group', { name: 'Score 1' })).toBeVisible();

    await advance(page, 2);
    expect((await state(page)).score).toBe(1);
  });

  test('extra balls in flight never score a destroyed ship twice', async ({ page }) => {
    const before = await state(page);
    await spawnEnemy(page, 'chaser', before.player.x + 260, before.player.y);
    await holdKey(page, 'Space', 1.4);
    await advance(page, 1);
    const after = await state(page);
    expect(after.enemies).toHaveLength(0);
    expect(after.score).toBe(1);
    expect(after.player.health).toBe(after.player.maxHealth);
  });

  test('islands stop cannonballs', async ({ page }) => {
    // Aim at the north-east island from the open sea to its west.
    await page.evaluate(() => window.__pirateBattle?.setPlayerPose(900, 160, 0));
    await page.keyboard.press('Space');
    await advance(page, 0.5);
    expect((await state(page)).projectiles).toHaveLength(0);
  });
});
