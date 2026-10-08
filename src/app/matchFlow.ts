import type { MatchSubmission } from '../api/contracts';
import { configKeyOf, createMatchConfig, RULESET_VERSION, type PlayerGameOptions } from '../game/config/gameConfig';
import type { MatchOutcome } from '../game/core/GameSession';
import type { MatchSetup } from '../game/world/WorldHost';

/** A new match: fresh id (also the idempotency key), seed and frozen config snapshot. */
export function createMatch(options: PlayerGameOptions, seedOverride: number | null): MatchSetup {
  return {
    matchId: crypto.randomUUID(),
    seed: seedOverride ?? crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
    options: { ...options },
    config: createMatchConfig(options),
  };
}

export function buildSubmission(
  match: MatchSetup,
  outcome: MatchOutcome,
  player: { playerId: string; playerName: string },
  endedAt: Date,
): MatchSubmission {
  return {
    matchId: match.matchId,
    playerId: player.playerId,
    playerName: player.playerName,
    playedAt: endedAt.toISOString(),
    score: outcome.score,
    durationSeconds: Math.round(outcome.durationSeconds * 10) / 10,
    endReason: outcome.endReason,
    config: { ...match.options, rulesetVersion: RULESET_VERSION },
    configKey: configKeyOf(match.options),
  };
}
