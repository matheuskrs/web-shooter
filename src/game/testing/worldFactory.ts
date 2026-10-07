import { ARENA_LAYOUT, buildObstacles, type ArenaLayout } from '../arena/arenaLayout';
import type { ObstacleShape } from '../collision/geometry';
import { createMatchConfig, DEFAULT_GAME_OPTIONS, type PlayerGameOptions } from '../config/gameConfig';
import { Rng } from '../math/rng';
import { World } from '../simulation/World';

export interface WorldOptions {
  seed?: number;
  options?: PlayerGameOptions;
  layout?: ArenaLayout;
  obstacles?: readonly ObstacleShape[];
}

/** Builds a match world exactly as a session does; also used by unit tests. */
export function createWorld({ seed = 1, options = DEFAULT_GAME_OPTIONS, layout = ARENA_LAYOUT, obstacles }: WorldOptions = {}): World {
  return new World(
    createMatchConfig(options),
    obstacles ?? buildObstacles(layout),
    new Rng(seed),
    layout.playerSpawn,
  );
}
