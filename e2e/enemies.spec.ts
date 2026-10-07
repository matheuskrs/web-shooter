import { expect, test } from '@playwright/test';
import { advance, openApp, quietBattle, saveOptions, spawnEnemy, startBattle, state } from './support';

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test.describe('Enemies', () => {
  test('a chaser hunts the player and explodes on impact without scoring', async ({ page }) => {
    await quietBattle(page);
    const start = await state(page);
    // Open water between the chaser and the player, so this measures pursuit, not island avoidance.
    const id = await spawnEnemy(page, 'chaser', 1350, 420);
    const initial = distance(start.player, { x: 1350, y: 420 });

    await advance(page, 1);
    const closing = await state(page);
    const chaser = closing.enemies.find((enemy) => enemy.id === id)!;
    expect(distance(closing.player, chaser)).toBeLessThan(initial - 120);

    await advance(page, 5);
    const after = await state(page);
    expect(after.enemies.find((enemy) => enemy.id === id)).toBeUndefined();
    expect(after.player.health).toBe(after.player.maxHealth - 20);
    expect(after.score).toBe(0);
  });

  test('a shooter closes to firing range, holds its distance and fires', async ({ page }) => {
    await quietBattle(page);
    const id = await spawnEnemy(page, 'shooter', 1400, 420);

    await advance(page, 5);
    const holding = await state(page);
    const shooter = holding.enemies.find((enemy) => enemy.id === id)!;
    const gap = distance(holding.player, shooter);
    expect(gap).toBeLessThanOrEqual(500);
    expect(gap).toBeGreaterThan(220);

    await advance(page, 6);
    const later = await state(page);
    expect(later.player.health).toBeLessThan(later.player.maxHealth);
    const stillThere = later.enemies.find((enemy) => enemy.id === id)!;
    expect(distance(later.player, stillThere)).toBeGreaterThan(220);
  });

  test('enemies spawn on the configured interval, away from the player, and both kinds appear', async ({ page }) => {
    await openApp(page);
    await saveOptions(page, { spawn: '2' });
    await startBattle(page);

    const seen = new Map<number, string>();
    const record = async () => {
      const snapshot = await state(page);
      for (const enemy of snapshot.enemies) {
        if (!seen.has(enemy.id)) {
          seen.set(enemy.id, enemy.kind);
          expect(distance(snapshot.player, enemy)).toBeGreaterThan(400);
        }
      }
    };

    await advance(page, 1.9);
    await record();
    expect(seen.size).toBe(0);
    await advance(page, 0.2);
    await record();
    expect(seen.size).toBe(1);
    await advance(page, 2);
    await record();
    expect(seen.size).toBe(2);
    for (let i = 0; i < 4; i++) {
      await advance(page, 2);
      await record();
    }
    expect(seen.size).toBe(6);
    expect(new Set(seen.values())).toEqual(new Set(['chaser', 'shooter']));
  });
});
