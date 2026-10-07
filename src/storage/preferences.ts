import {
  DEFAULT_GAME_OPTIONS,
  isValidSessionSeconds,
  isValidSpawnInterval,
  type PlayerGameOptions,
} from '../game/config/gameConfig';
import { createStoredValue, isRecord } from './storedValue';

export interface Preferences extends PlayerGameOptions {
  captainName: string;
  muted: boolean;
}

export const CAPTAIN_NAME_MAX_LENGTH = 16;

export const DEFAULT_PREFERENCES: Preferences = {
  ...DEFAULT_GAME_OPTIONS,
  captainName: 'Captain Jack',
  muted: false,
};

export function isValidCaptainName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= CAPTAIN_NAME_MAX_LENGTH;
}

function isPreferences(value: unknown): value is Preferences {
  return (
    isRecord(value) &&
    typeof value.sessionSeconds === 'number' &&
    isValidSessionSeconds(value.sessionSeconds) &&
    typeof value.spawnIntervalSeconds === 'number' &&
    isValidSpawnInterval(value.spawnIntervalSeconds) &&
    typeof value.captainName === 'string' &&
    isValidCaptainName(value.captainName) &&
    typeof value.muted === 'boolean'
  );
}

export const preferencesStore = createStoredValue<Preferences>('pirate-battle:preferences:v1', isPreferences, DEFAULT_PREFERENCES);

export function gameOptionsOf(preferences: Preferences): PlayerGameOptions {
  return { sessionSeconds: preferences.sessionSeconds, spawnIntervalSeconds: preferences.spawnIntervalSeconds };
}
