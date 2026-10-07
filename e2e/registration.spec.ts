import { expect, test, type Page } from '@playwright/test';
import { advance, openApp, saveOptions, setAutoSpawn, spawnEnemy, startBattle, state } from './support';

async function playShortMatch(page: Page, { kills = 0 } = {}) {
  await saveOptions(page, { session: '60' });
  await startBattle(page);
  await setAutoSpawn(page, false);
  for (let i = 0; i < kills; i++) {
    const { player } = await state(page);
    await spawnEnemy(page, 'chaser', player.x + 300, player.y);
    await page.keyboard.down('Space');
    await advance(page, 0.9);
    await page.keyboard.up('Space');
    await advance(page, 0.6);
  }
  await advance(page, 61);
  await expect(page.getByRole('heading', { name: 'Battle Complete' })).toBeVisible();
}

async function useScenario(page: Page, scenario: string) {
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByText('Network simulation').click();
  await page.getByLabel('Mock API scenario').selectOption(scenario);
  await page.getByRole('button', { name: 'Main Menu' }).click();
}

const historyRows = (page: Page) => page.getByRole('tabpanel').locator('tbody tr');

/** Counts this player's entries across every ranking page, straight from the (mocked) API. */
async function myRankingEntries(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const last = JSON.parse(localStorage.getItem('pirate-battle:last-result:v1') ?? 'null');
    const response = await fetch(`/api/ranking?configKey=${last.submission.configKey}&page=1&pageSize=50`);
    const body = await response.json();
    return body.items.filter((entry: { playerId: string }) => entry.playerId === last.submission.playerId).length;
  });
}

async function showLastRankingPage(page: Page) {
  const next = page.getByRole('button', { name: 'Next page' });
  await expect(page.getByRole('tabpanel').locator('tbody tr').first()).toBeVisible();
  while (await next.isEnabled()) await next.click();
}

test.describe('Match registration', () => {
  test('a finished match appears once in history and once in the ranking', async ({ page }) => {
    await openApp(page);
    await playShortMatch(page, { kills: 2 });
    await expect(page.getByLabel('2 points')).toBeVisible();
    await expect(page.getByText('Logged in the Captain’s Log.')).toBeVisible();

    expect(await myRankingEntries(page)).toBe(1);
    await page.getByRole('button', { name: 'Main Menu' }).click();
    // The ranking compares only 60 s matches with the same spawn time: fixtures + ours.
    await expect(page.locator('caption')).toContainText('60 second battles');
    await showLastRankingPage(page);
    await expect(page.getByRole('tabpanel').locator('tr', { hasText: 'You' })).toHaveCount(1);

    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(historyRows(page)).toHaveCount(1);
    await expect(historyRows(page).first()).toContainText('01:00');
    await expect(historyRows(page).first()).toContainText('Time up');
    await expect(historyRows(page).first()).toContainText('2');
  });

  test('a match finished while the service is down is kept and registered after a refresh', async ({ page }) => {
    await openApp(page, { scenario: 'register-unavailable' });
    await playShortMatch(page);
    await expect(page.getByText('Not logged yet.', { exact: false })).toBeVisible({ timeout: 10_000 });

    // A pending upload never blocks the next battle.
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await expect(page.getByText('1 battle waiting to be logged.')).toBeVisible();
    await startBattle(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main Menu' }).click();

    await useScenario(page, 'success');
    await page.goto('/?clock=manual');
    await expect(page.getByText('battle waiting to be logged')).toBeHidden({ timeout: 10_000 });
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(historyRows(page)).toHaveCount(1);
  });

  test('retrying after a timeout recovers the stored record without duplicates', async ({ page }) => {
    await openApp(page, { scenario: 'register-timeout-after-commit' });
    await playShortMatch(page);
    // First reply is dropped after the server stored the match; the client times out and retries.
    await expect(page.getByText('Logged in the Captain’s Log.')).toBeVisible({ timeout: 15_000 });

    // Repeated manual submissions of the same match still map to one record.
    await page.evaluate(async () => {
      const last = JSON.parse(localStorage.getItem('pirate-battle:last-result:v1') ?? 'null');
      for (let i = 0; i < 3; i++) {
        await fetch('/api/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': last.submission.matchId },
          body: JSON.stringify(last.submission),
        });
      }
    });

    await page.getByRole('button', { name: 'Main Menu' }).click();
    await page.getByRole('tab', { name: 'Match History' }).click();
    await expect(historyRows(page)).toHaveCount(1);
    expect(await myRankingEntries(page)).toBe(1);
  });

  test('delayed responses never overwrite newer data', async ({ page }) => {
    // Odd requests answer after 2.2 s, even ones after 0.25 s.
    await openApp(page, { scenario: 'out-of-order' });
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('Page 1 of 12')).toBeVisible({ timeout: 6_000 });

    await page.getByRole('button', { name: 'Next page' }).click(); // fast
    await expect(panel.getByText('Page 2 of 12')).toBeVisible();
    await page.getByRole('button', { name: 'Next page' }).click(); // slow request for page 3
    await page.getByRole('button', { name: 'Previous page' }).click(); // back to page 2 before it lands

    await page.waitForTimeout(2600);
    await expect(panel.getByText('Page 2 of 12')).toBeVisible();
    await expect(historyRows(page).first().locator('td').first()).toHaveText('06');
  });
});
