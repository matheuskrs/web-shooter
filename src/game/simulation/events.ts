import type { EnemyKind, ShipKind } from '../config/gameConfig';
import type { Team, WeaponSlot } from './entities';

export type EndReason = 'time_up' | 'defeated';

export type DestroyCause = 'cannon' | 'ram';

/**
 * Facts produced by the simulation during a step. Rendering, audio and the UI
 * bridge consume them after the step; none of them can change gameplay.
 */
export type GameEvent =
  | {
      type: 'shotFired';
      shipId: number;
      team: Team;
      slot: WeaponSlot;
      /** Centre muzzle; parallel guns sit `spacing` apart along `keelAngle`. */
      x: number;
      y: number;
      angle: number;
      keelAngle: number;
      count: number;
      spacing: number;
    }
  | { type: 'shipHit'; shipId: number; team: Team; x: number; y: number; damage: number }
  | { type: 'projectileSplash'; x: number; y: number }
  | { type: 'projectileHitObstacle'; x: number; y: number }
  | { type: 'shipDamaged'; shipId: number; team: Team; health: number; maxHealth: number }
  | {
      type: 'shipDestroyed';
      shipId: number;
      kind: ShipKind;
      team: Team;
      cause: DestroyCause;
      x: number;
      y: number;
      heading: number;
    }
  | { type: 'chaserRammed'; x: number; y: number }
  | { type: 'enemySpawned'; shipId: number; kind: EnemyKind; x: number; y: number }
  | { type: 'scoreChanged'; score: number }
  | { type: 'matchEnded'; reason: EndReason };
