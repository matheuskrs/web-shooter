import type { EnemyKind, ShipKind } from '../config/gameConfig';
import type { GameSession } from '../core/GameSession';
import { diagnostics } from '../diagnostics/diagnostics';
import type { Ship } from '../simulation/entities';
import { spawnEnemy } from '../systems/spawnSystem';

/**
 * Deliberately small instrumentation for automated tests, compiled only into
 * non-production builds. It can observe state, drive the manual clock and
 * arrange a scene (place ships, pause the spawner). It cannot move, shoot or
 * damage anything: tests do that through real keyboard and touch input, and
 * the real systems, collisions and renderer produce the outcome.
 */
export interface TestShipSnapshot {
  id: number;
  kind: ShipKind;
  x: number;
  y: number;
  heading: number;
  speed: number;
  health: number;
  maxHealth: number;
}

export interface TestSnapshot {
  phase: string;
  endReason: string | null;
  score: number;
  elapsed: number;
  remainingSeconds: number;
  steps: number;
  player: TestShipSnapshot;
  enemies: TestShipSnapshot[];
  projectiles: { id: number; team: string; slot: string; x: number; y: number }[];
  cooldowns: { front: number; left: number; right: number };
  spawnTimer: number;
  arena: { width: number; height: number };
  sprites: { ships: number; projectiles: number; wrecks: number; effects: number } | null;
}

export interface PirateBattleTestApi {
  /** True once the PLAY camera has landed and the player is in control. */
  isReady(): boolean;
  getState(): TestSnapshot | null;
  /** Runs the simulation for `seconds` of game time (manual clock only). */
  advance(seconds: number): void;
  spawnEnemy(kind: EnemyKind, x: number, y: number): number | null;
  setPlayerPose(x: number, y: number, heading: number): void;
  /** Stops or restarts automatic spawning so a test controls who is on the water. */
  setAutoSpawn(enabled: boolean): void;
  /** Total sessions created and disposed since load, for lifecycle checks. */
  lifecycle(): { created: number; disposed: number; live: number };
  /** The page's shared world: menu fleet size and camera state. */
  world(): WorldProbe | null;
}

export interface WorldProbe {
  attractShips: number;
  camera: { x: number; y: number; zoom: number };
  travelling: boolean;
  activeMatchId: string | null;
}

declare global {
  interface Window {
    __pirateBattle?: PirateBattleTestApi;
  }
}

let current: GameSession | null = null;
let worldProbe: (() => WorldProbe) | null = null;

/** The WorldHost registers a read-only probe of itself. */
export function trackWorld(probe: () => WorldProbe): void {
  worldProbe = probe;
}

function snapshotShip(ship: Ship): TestShipSnapshot {
  return {
    id: ship.id,
    kind: ship.kind,
    x: ship.x,
    y: ship.y,
    heading: ship.heading,
    speed: ship.speed,
    health: ship.health,
    maxHealth: ship.config.maxHealth,
  };
}

export const testHooksEnabled = import.meta.env.MODE !== 'production';

export function installTestApi(): void {
  if (!testHooksEnabled || window.__pirateBattle) return;
  window.__pirateBattle = {
    isReady: () => !!current && current.isRunning,
    getState: () => {
      if (!current) return null;
      const world = current.world;
      return {
        phase: world.phase,
        endReason: world.endReason,
        score: world.score,
        elapsed: world.elapsed,
        remainingSeconds: world.remainingSeconds,
        steps: world.steps,
        player: snapshotShip(world.requirePlayer()),
        enemies: world.ships.filter((ship) => ship.team === 'enemy' && ship.alive).map(snapshotShip),
        projectiles: world.projectiles
          .filter((projectile) => projectile.alive)
          .map(({ id, team, slot, x, y }) => ({ id, team, slot, x, y })),
        cooldowns: { ...world.requirePlayer().cooldowns },
        spawnTimer: world.spawner.timer,
        arena: { ...world.config.arena },
        sprites: current.rendererStats,
      };
    },
    advance: (seconds) => current?.advanceManually(seconds),
    spawnEnemy: (kind, x, y) => (current ? spawnEnemy(current.world, kind, x, y).id : null),
    setPlayerPose: (x, y, heading) => {
      if (!current) return;
      const player = current.world.requirePlayer();
      player.x = player.prevX = x;
      player.y = player.prevY = y;
      player.heading = player.prevHeading = heading;
      player.speed = 0;
    },
    setAutoSpawn: (enabled) => {
      if (current) current.world.spawner.timer = enabled ? current.world.config.spawn.intervalSeconds : Number.POSITIVE_INFINITY;
    },
    world: () => worldProbe?.() ?? null,
    lifecycle: () => ({
      created: diagnostics.sessionsCreated,
      disposed: diagnostics.sessionsDisposed,
      live: diagnostics.sessionsCreated - diagnostics.sessionsDisposed,
    }),
  };
}

/** Points the test API at the mounted session; the returned function forgets it. */
export function trackSession(session: GameSession): () => void {
  current = session;
  return () => {
    if (current === session) current = null;
  };
}

/** Reads test-only URL overrides (`?seed=42&clock=manual`). Ignored in production builds. */
export function readTestOverrides(): { seed: number | null; manualClock: boolean } {
  if (!testHooksEnabled) return { seed: null, manualClock: false };
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed'));
  return {
    seed: params.has('seed') && Number.isFinite(seed) ? seed : null,
    manualClock: params.get('clock') === 'manual',
  };
}
