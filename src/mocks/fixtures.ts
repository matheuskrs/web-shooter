import type { EndReason, MatchConfigDto, MatchRecord } from '../api/contracts';
import { hashString, Rng } from '../game/math/rng';

const CAPTAINS = [
  'Captain Flint',
  'Red Sparrow',
  'Storm Rider',
  'Sea Wolf',
  'Iron Hook',
  'Salty Meg',
  'Black Tide',
  'Barnacle Bill',
  'Coral Queen',
  'One-Eyed Finn',
  'Gale Morgan',
  'Rusty Anchor',
];

/** Fixed base date so fixtures never change between runs or depend on the clock. */
const FIXTURE_EPOCH = Date.parse('2026-09-08T21:42:00Z');

export const FIXTURE_COUNTS = {
  rankingNormal: 12,
  rankingMany: 57,
  historyMany: 23,
} as const;

/** Inverse of `configKeyOf` ("r1-t120-s3"); unknown keys fall back to the defaults. */
export function parseConfigKey(configKey: string): MatchConfigDto {
  const match = /^r(\d+)-t(\d+)-s([\d.]+)$/.exec(configKey);
  return {
    rulesetVersion: Number(match?.[1] ?? 1),
    sessionSeconds: Number(match?.[2] ?? 120),
    spawnIntervalSeconds: Number(match?.[3] ?? 3),
  };
}

function fixtureRecord(rng: Rng, index: number, configKey: string, playerId: string, playerName: string, idPrefix: string): MatchRecord {
  const config = parseConfigKey(configKey);
  const defeated = rng.next() < 0.35;
  const endReason: EndReason = defeated ? 'defeated' : 'time_up';
  const durationSeconds = defeated ? Math.round(config.sessionSeconds * rng.range(0.35, 0.95)) : config.sessionSeconds;
  // Roughly one kill every 4-7 seconds, scaled by how often enemies appear.
  const pace = rng.range(4, 7) * Math.max(0.6, config.spawnIntervalSeconds / 3);
  const score = Math.max(0, Math.round(durationSeconds / pace));
  const playedAt = new Date(FIXTURE_EPOCH - index * 46 * 60_000 - rng.int(0, 40) * 60_000).toISOString();
  return {
    matchId: `${idPrefix}-${index.toString().padStart(3, '0')}`,
    playerId,
    playerName,
    playedAt,
    score,
    durationSeconds,
    endReason,
    config,
    configKey,
    recordedAt: playedAt,
  };
}

/** Other captains' matches for one configuration; same key always yields the same fleet. */
export function rankingFixtures(configKey: string, count: number): MatchRecord[] {
  const rng = new Rng(hashString(`ranking:${configKey}`));
  return Array.from({ length: count }, (_, index) => {
    const captain = index % CAPTAINS.length;
    return fixtureRecord(rng, index, configKey, `fixture-captain-${captain}`, CAPTAINS[captain] ?? 'Captain', `fixture-${hashString(configKey).toString(36)}`);
  });
}

/** Extra past battles for the local player, only used by the "many pages" scenario. */
export function historyFixtures(playerId: string, playerName: string, configKey: string, count: number): MatchRecord[] {
  const rng = new Rng(hashString(`history:${playerId}`));
  return Array.from({ length: count }, (_, index) => fixtureRecord(rng, index + 1, configKey, playerId, playerName, 'fixture-history'));
}
