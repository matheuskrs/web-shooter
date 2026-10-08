import type { SoundName } from '../assets/assetManifest';
import type { Rng } from '../math/rng';
import type { GameEvent } from '../simulation/events';
import type { World } from '../simulation/World';
import type { AudioManager, LoopHandle } from './AudioManager';

const OCEAN_VOLUME = 0.35;
const SAILING_MAX_VOLUME = 0.3;
const LOW_HEALTH_RATIO = 0.3;
const TIME_WARNING_SECONDS = 10;

/**
 * Turns simulation events into sound for one match and owns that match's
 * looping voices, so disposing the session silences everything it started.
 */
export class BattleAudio {
  private ocean: LoopHandle | null = null;
  private sailing: LoopHandle | null = null;
  private lastWarningSecond = Number.POSITIVE_INFINITY;
  private lowHealthWarned = false;

  constructor(
    private readonly audio: AudioManager,
    private readonly rng: Rng,
  ) {}

  start(): void {
    this.audio.play('game_start', { volume: 0.6 });
    this.ocean = this.audio.loop('ocean_ambience_loop', OCEAN_VOLUME);
    this.sailing = this.audio.loop('ship_sailing_loop', 0);
  }

  handleEvents(events: readonly GameEvent[], world: World): void {
    for (const event of events) {
      switch (event.type) {
        case 'shotFired':
          if (event.slot === 'front') {
            const volume = event.team === 'player' ? 0.55 : 0.35;
            this.play(this.pickCannon(), volume, event.team === 'enemy' ? 0.85 : 1.05);
          } else {
            this.play('cannon_broadside', 0.85, 1);
          }
          break;
        case 'shipHit':
          this.play(this.rng.next() < 0.5 ? 'ship_wood_hit_1' : 'ship_wood_hit_2', event.team === 'player' ? 0.9 : 0.6, 1);
          break;
        case 'projectileSplash':
          this.play(this.rng.next() < 0.5 ? 'cannonball_water_hit_1' : 'cannonball_water_hit_2', 0.3, 1);
          break;
        case 'projectileHitObstacle':
          this.play('cannonball_water_hit_2', 0.25, 0.7);
          break;
        case 'chaserRammed':
          this.play('ship_collision', 0.9, 1);
          break;
        case 'shipDestroyed':
          if (event.team === 'player') {
            this.play('ship_sinking', 0.9, 1);
          } else {
            this.play(this.rng.next() < 0.5 ? 'ship_explosion_1' : 'ship_explosion_2', 0.75, 1);
          }
          break;
        case 'scoreChanged':
          this.play('score_point', 0.5, 1);
          break;
        case 'shipDamaged':
          if (event.team === 'player' && !this.lowHealthWarned && event.health > 0 && event.health / event.maxHealth <= LOW_HEALTH_RATIO) {
            this.lowHealthWarned = true;
            this.play('health_low', 0.7, 1);
          }
          break;
        case 'matchEnded':
          this.play(event.reason === 'time_up' ? 'game_complete' : 'game_over', 0.8, 1);
          this.sailing?.setVolume(0, 0.4);
          break;
        default:
          break;
      }
    }
    if (world.phase !== 'running') return;
    const second = Math.ceil(world.remainingSeconds);
    if (second <= TIME_WARNING_SECONDS && second < this.lastWarningSecond && second > 0) {
      this.lastWarningSecond = second;
      this.play('time_warning', 0.45, 1);
    }
  }

  /** Engine noise follows the player's speed. */
  update(world: World): void {
    const player = world.requirePlayer();
    const ratio = player.alive && world.phase === 'running' ? player.speed / player.config.movement.maxSpeed : 0;
    this.sailing?.setVolume(ratio * SAILING_MAX_VOLUME);
  }

  pause(): void {
    this.audio.play('game_pause', { volume: 0.6 });
    this.ocean?.setVolume(OCEAN_VOLUME * 0.3);
    this.sailing?.setVolume(0);
  }

  resume(): void {
    this.audio.play('game_resume', { volume: 0.6 });
    this.ocean?.setVolume(OCEAN_VOLUME);
  }

  dispose(): void {
    this.ocean?.stop();
    this.sailing?.stop();
    this.ocean = null;
    this.sailing = null;
  }

  private pickCannon(): SoundName {
    return this.rng.pick(['cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3'] as const);
  }

  private play(name: SoundName, volume: number, rate: number): void {
    // Slight pitch variation keeps rapid fire from sounding mechanical.
    this.audio.play(name, { volume, rate: rate * this.rng.range(0.94, 1.06) });
  }
}
