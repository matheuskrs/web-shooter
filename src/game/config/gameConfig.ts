/**
 * Central, typed gameplay configuration. Systems only read values from here,
 * so balancing never requires touching simulation logic.
 *
 * Units: distances in logical arena pixels, time in seconds, angles in radians.
 */

export type EnemyKind = 'chaser' | 'shooter';
export type ShipKind = 'player' | EnemyKind;

/** Bump when balance changes so rankings never compare different rulesets. */
export const RULESET_VERSION = 1;

export interface HullConfig {
  /** Collider circle centres along the keel, relative to the ship centre (+ = bow). */
  circleOffsets: readonly number[];
  /** Radius used against islands, arena bounds and other ships. */
  radius: number;
  /** Extra radius for cannonball hits so shots grazing the sails still connect. */
  hitRadiusBonus: number;
}

export interface MovementConfig {
  maxSpeed: number;
  /** Speed gained per second while the throttle is engaged. */
  acceleration: number;
  /** Speed lost per second while coasting. */
  deceleration: number;
  /** Turn rate in rad/s at full speed. */
  turnRate: number;
  /** Fraction of turnRate available when stationary, so ships can pivot in place. */
  stationaryTurnFactor: number;
}

export interface ShipConfig {
  maxHealth: number;
  movement: MovementConfig;
  hull: HullConfig;
}

export interface WeaponConfig {
  cooldownSeconds: number;
  damage: number;
  projectileSpeed: number;
  /** Distance a projectile travels before it splashes into the sea. */
  range: number;
  projectileRadius: number;
  /** Number of balls fired at once (broadsides fire several in parallel). */
  projectileCount: number;
  /** Distance between parallel balls along the hull. */
  spacing: number;
  /** Muzzle distance from the keel line (broadside) or from the centre (bow). */
  muzzleOffset: number;
}

export interface ShooterBehaviourConfig {
  /** Fires only when the player is closer than this. */
  attackRange: number;
  /** Distance the shooter tries to hold while firing. */
  preferredRange: number;
  /** Closer than this, the shooter turns away to reopen the gap. */
  minRange: number;
  /** Maximum aim error (rad) before it fires. */
  aimTolerance: number;
}

export interface SpawnConfig {
  intervalSeconds: number;
  firstSpawnDelaySeconds: number;
  /** Relative weights; a shuffled bag guarantees every kind appears early. */
  weights: Readonly<Record<EnemyKind, number>>;
  maxAliveEnemies: number;
  minDistanceFromPlayer: number;
  /** Clearance kept from islands and other ships at the spawn point. */
  clearance: number;
}

export interface ArenaConfig {
  width: number;
  height: number;
}

export interface GameConfig {
  rulesetVersion: number;
  sessionSeconds: number;
  arena: ArenaConfig;
  spawn: SpawnConfig;
  player: ShipConfig & {
    bowCannon: WeaponConfig;
    broadside: WeaponConfig;
  };
  chaser: ShipConfig & {
    ramDamage: number;
  };
  shooter: ShipConfig & {
    cannon: WeaponConfig;
    behaviour: ShooterBehaviourConfig;
  };
}

export const SESSION_SECONDS_LIMITS = { min: 60, max: 180, step: 10 } as const;
export const SPAWN_INTERVAL_LIMITS = { min: 1, max: 10, step: 0.5 } as const;

/** The two values the player may change in Options. */
export interface PlayerGameOptions {
  sessionSeconds: number;
  spawnIntervalSeconds: number;
}

export const DEFAULT_GAME_OPTIONS: PlayerGameOptions = {
  sessionSeconds: 120,
  spawnIntervalSeconds: 3,
};

const SHIP_HULL: HullConfig = { circleOffsets: [-28, 0, 28], radius: 17, hitRadiusBonus: 7 };

export const BASE_GAME_CONFIG: GameConfig = {
  rulesetVersion: RULESET_VERSION,
  sessionSeconds: DEFAULT_GAME_OPTIONS.sessionSeconds,
  arena: { width: 1600, height: 900 },
  spawn: {
    intervalSeconds: DEFAULT_GAME_OPTIONS.spawnIntervalSeconds,
    firstSpawnDelaySeconds: 1.5,
    weights: { chaser: 3, shooter: 2 },
    maxAliveEnemies: 10,
    minDistanceFromPlayer: 520,
    clearance: 60,
  },
  player: {
    maxHealth: 100,
    movement: {
      maxSpeed: 230,
      acceleration: 900,
      deceleration: 420,
      turnRate: 3.1,
      stationaryTurnFactor: 0.75,
    },
    hull: SHIP_HULL,
    bowCannon: {
      cooldownSeconds: 0.32,
      damage: 20,
      projectileSpeed: 720,
      range: 620,
      projectileRadius: 5,
      projectileCount: 1,
      spacing: 0,
      muzzleOffset: 50,
    },
    broadside: {
      cooldownSeconds: 1.4,
      damage: 25,
      projectileSpeed: 560,
      range: 420,
      projectileRadius: 6,
      projectileCount: 3,
      spacing: 26,
      muzzleOffset: 22,
    },
  },
  chaser: {
    maxHealth: 40,
    movement: {
      maxSpeed: 185,
      acceleration: 400,
      deceleration: 300,
      turnRate: 2.3,
      stationaryTurnFactor: 0.6,
    },
    hull: { circleOffsets: [-22, 0, 22], radius: 15, hitRadiusBonus: 7 },
    ramDamage: 25,
  },
  shooter: {
    maxHealth: 60,
    movement: {
      maxSpeed: 120,
      acceleration: 220,
      deceleration: 200,
      turnRate: 1.6,
      stationaryTurnFactor: 0.8,
    },
    hull: SHIP_HULL,
    cannon: {
      cooldownSeconds: 1.9,
      damage: 10,
      projectileSpeed: 430,
      range: 560,
      projectileRadius: 5,
      projectileCount: 1,
      spacing: 0,
      muzzleOffset: 50,
    },
    behaviour: {
      attackRange: 500,
      preferredRange: 360,
      minRange: 220,
      aimTolerance: 0.14,
    },
  },
};

export function isValidSessionSeconds(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= SESSION_SECONDS_LIMITS.min &&
    value <= SESSION_SECONDS_LIMITS.max
  );
}

export function isValidSpawnInterval(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= SPAWN_INTERVAL_LIMITS.min &&
    value <= SPAWN_INTERVAL_LIMITS.max &&
    Number.isInteger(value / SPAWN_INTERVAL_LIMITS.step)
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Builds the immutable configuration snapshot a match runs with. Options
 * changed afterwards only affect matches created later.
 */
export function createMatchConfig(options: PlayerGameOptions): GameConfig {
  const snapshot: GameConfig = structuredClone(BASE_GAME_CONFIG);
  snapshot.sessionSeconds = options.sessionSeconds;
  snapshot.spawn.intervalSeconds = options.spawnIntervalSeconds;
  return deepFreeze(snapshot);
}

/**
 * Deterministic fingerprint of everything that makes two matches comparable.
 * Ranking only compares records sharing this key.
 */
export function configKeyOf(options: PlayerGameOptions): string {
  return `r${RULESET_VERSION}-t${options.sessionSeconds}-s${options.spawnIntervalSeconds}`;
}
