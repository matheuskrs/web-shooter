import { expect, type Page } from '@playwright/test';
import type { EnemyKind } from '../src/game/config/gameConfig';
import type { TestSnapshot } from '../src/game/testing/testApi';

export const DEFAULT_SEED = 1234;

export interface OpenOptions {
  scenario?: string;
  seed?: number;
  /** Manual simulation clock; on by default so gameplay is driven step by step. */
  manualClock?: boolean;
  hash?: string;
}

export async function openApp(page: Page, { scenario, seed = DEFAULT_SEED, manualClock = true, hash = '' }: OpenOptions = {}) {
  const params = new URLSearchParams({ seed: String(seed) });
  if (manualClock) params.set('clock', 'manual');
  if (scenario) params.set('scenario', scenario);
  await page.goto(`/?${params.toString()}${hash}`);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
}

/** Clicks Play and waits until the session is mounted and rendering. */
export async function startBattle(page: Page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => window.__pirateBattle?.isReady() === true);
}

export async function state(page: Page): Promise<TestSnapshot> {
  const snapshot = await page.evaluate(() => window.__pirateBattle?.getState() ?? null);
  if (!snapshot) throw new Error('No active battle');
  return snapshot;
}

export async function advance(page: Page, seconds: number) {
  await page.evaluate((s) => window.__pirateBattle?.advance(s), seconds);
}

export async function setAutoSpawn(page: Page, enabled: boolean) {
  await page.evaluate((on) => window.__pirateBattle?.setAutoSpawn(on), enabled);
}

export async function setPlayerPose(page: Page, x: number, y: number, heading: number) {
  await page.evaluate(([px, py, ph]) => window.__pirateBattle?.setPlayerPose(px, py, ph), [x, y, heading] as const);
}

export async function spawnEnemy(page: Page, kind: EnemyKind, x: number, y: number): Promise<number> {
  const id = await page.evaluate(([k, px, py]) => window.__pirateBattle?.spawnEnemy(k, px, py) ?? null, [kind, x, y] as const);
  if (id === null) throw new Error('Could not spawn enemy');
  return id;
}

/** Holds a real key while the simulation advances, then releases it. */
export async function holdKey(page: Page, key: string, seconds: number) {
  await page.keyboard.down(key);
  await advance(page, seconds);
  await page.keyboard.up(key);
}

/** Open sea battle: player at the empty middle of the map, no automatic spawns. */
export async function quietBattle(page: Page, options: OpenOptions = {}) {
  await openApp(page, options);
  await startBattle(page);
  await setAutoSpawn(page, false);
}

export async function saveOptions(page: Page, values: { session?: string; spawn?: string }) {
  await page.getByRole('button', { name: 'Options' }).click();
  if (values.session !== undefined) await page.getByLabel('Game session time', { exact: true }).fill(values.session);
  if (values.spawn !== undefined) await page.getByLabel('Enemy spawn time', { exact: true }).fill(values.spawn);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu' }).click();
}

/** From the main menu, open the Captain's Log on one of its tabs. */
export async function openLog(page: Page, tab: 'Ranking' | 'Match History') {
  await page.getByRole('button', { name: tab, exact: true }).click();
  await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
}

/** Picks a mock API scenario through the Options screen (an Ant Design Select). */
export async function chooseScenario(page: Page, label: string) {
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByText('Network simulation').click();
  await page.getByLabel('Mock API scenario').click();
  await page.locator('.ant-select-item-option').filter({ hasText: new RegExp(`^${label}$`) }).click();
  await page.getByRole('button', { name: 'Main Menu' }).click();
}

/** The bottom-centre toast with this text. */
export function toast(page: Page, text: string) {
  return page.locator('.pirate-toast').filter({ hasText: text });
}

export async function lifecycle(page: Page) {
  return page.evaluate(() => window.__pirateBattle!.lifecycle());
}
