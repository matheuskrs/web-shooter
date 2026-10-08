import type { EnemyKind, GameConfig, ShipKind, WeaponConfig } from '../config/gameConfig';
import type { ObstacleShape } from '../collision/geometry';
import type { Rng } from '../math/rng';
import { createControls, type Projectile, type Ship, type WeaponSlot } from './entities';
import type { EndReason, GameEvent } from './events';

export type MatchPhase = 'running' | 'ended';

export interface SpawnerState {
  timer: number;
  bag: EnemyKind[];
}

/**
 * All mutable state of one simulated sea. Systems are plain functions that
 * read and write it in a fixed order (see stepSimulation). Nothing here knows
 * about Pixi, React or the DOM.
 *
 * A match world has a player ship; the menu's attract world reuses the same
 * type and systems without one (`player === null`).
 */
export class World {
  readonly ships: Ship[] = [];
  readonly projectiles: Projectile[] = [];
  /** Events accumulated since the last drain; consumers read them once per frame. */
  readonly events: GameEvent[] = [];
  readonly player: Ship | null;
  readonly spawner: SpawnerState;

  phase: MatchPhase = 'running';
  endReason: EndReason | null = null;
  /** Active (unpaused) simulated seconds. */
  elapsed = 0;
  score = 0;
  steps = 0;

  private nextId = 1;

  constructor(
    readonly config: GameConfig,
    readonly obstacles: readonly ObstacleShape[],
    readonly rng: Rng,
    playerSpawn: { x: number; y: number; heading: number } | null,
  ) {
    this.player = playerSpawn ? this.addShip('player', playerSpawn.x, playerSpawn.y, playerSpawn.heading) : null;
    this.spawner = { timer: config.spawn.firstSpawnDelaySeconds, bag: [] };
  }

  get remainingSeconds(): number {
    return Math.max(0, this.config.sessionSeconds - this.elapsed);
  }

  /** Match-only code calls this: a match world always has its player ship. */
  requirePlayer(): Ship {
    if (!this.player) throw new Error('This world has no player ship');
    return this.player;
  }

  allocateId(): number {
    return this.nextId++;
  }

  addShip(kind: ShipKind, x: number, y: number, heading: number): Ship {
    const shipConfig = this.config[kind];
    const weapons: Partial<Record<WeaponSlot, WeaponConfig>> =
      kind === 'player'
        ? {
            front: this.config.player.bowCannon,
            left: this.config.player.broadside,
            right: this.config.player.broadside,
          }
        : kind === 'shooter'
          ? { front: this.config.shooter.cannon }
          : {};
    const ship: Ship = {
      id: this.allocateId(),
      kind,
      team: kind === 'player' ? 'player' : 'enemy',
      config: shipConfig,
      weapons,
      x,
      y,
      heading,
      speed: 0,
      prevX: x,
      prevY: y,
      prevHeading: heading,
      health: shipConfig.maxHealth,
      alive: true,
      controls: createControls(),
      cooldowns: { front: 0, left: 0, right: 0 },
      brain: { avoidSide: 0, avoidTimer: 0, stuckTimer: 0 },
    };
    this.ships.push(ship);
    return ship;
  }

  aliveEnemyCount(): number {
    let count = 0;
    for (const ship of this.ships) if (ship.alive && ship.team === 'enemy') count++;
    return count;
  }

  findShip(id: number): Ship | undefined {
    return this.ships.find((ship) => ship.id === id);
  }

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  end(reason: EndReason): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.endReason = reason;
    this.emit({ type: 'matchEnded', reason });
  }

  /** Drops destroyed entities. Runs once at the end of every step. */
  removeDead(): void {
    compactInPlace(this.ships, (ship) => ship.alive || ship === this.player);
    compactInPlace(this.projectiles, (projectile) => projectile.alive);
  }
}

function compactInPlace<T>(items: T[], keep: (item: T) => boolean): void {
  let write = 0;
  for (let read = 0; read < items.length; read++) {
    const item = items[read] as T;
    if (keep(item)) items[write++] = item;
  }
  items.length = write;
}
