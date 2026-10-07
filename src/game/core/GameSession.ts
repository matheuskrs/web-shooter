import { Application, type Ticker } from 'pixi.js';
import { ARENA_LAYOUT, buildObstacles } from '../arena/arenaLayout';
import type { GameTextures } from '../assets/AssetLoader';
import type { AudioManager } from '../audio/AudioManager';
import { BattleAudio } from '../audio/BattleAudio';
import type { GameUiStore, PauseReason } from '../bridge/GameUiStore';
import type { GameConfig } from '../config/gameConfig';
import { diagnostics } from '../diagnostics/diagnostics';
import { PerfMonitor, type PerfSnapshot } from '../diagnostics/PerfMonitor';
import type { InputState } from '../input/InputState';
import { KeyboardInput } from '../input/KeyboardInput';
import { Rng } from '../math/rng';
import { GameRenderer } from '../rendering/GameRenderer';
import type { EndReason } from '../simulation/events';
import { stepSimulation } from '../simulation/stepSimulation';
import { World } from '../simulation/World';
import { createFireBuffer } from '../systems/playerControlSystem';
import { FixedStepLoop } from './FixedStepLoop';

export const STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
const MAX_RESOLUTION = 2;

export interface MatchOutcome {
  score: number;
  /** Active (unpaused) seconds actually played. */
  durationSeconds: number;
  endReason: EndReason;
}

export interface GameSessionOptions {
  config: GameConfig;
  textures: GameTextures;
  audio: AudioManager;
  store: GameUiStore;
  input: InputState;
  seed: number;
  /** When true the simulation only advances through `advanceManually` (tests). */
  manualClock?: boolean;
  /** Record frame timings and entity counts (`?perf`). */
  profile?: boolean;
  onEnded: (outcome: MatchOutcome) => void;
}

/**
 * Owns one match from mount to teardown: the Pixi application, the world, the
 * fixed-step loop, input bindings and the match's audio voices. React creates
 * a session when the battle screen mounts and disposes it on unmount.
 *
 * `dispose()` is idempotent and safe at any moment, including while the
 * async Pixi initialisation is still running (React Strict Mode mounts,
 * unmounts and remounts effects in development).
 */
export class GameSession {
  readonly world: World;
  private readonly loop: FixedStepLoop;
  private readonly keyboard: KeyboardInput;
  private readonly battleAudio: BattleAudio;
  private readonly fireBuffer = createFireBuffer();
  private app: Application | null = null;
  private renderer: GameRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private paused = false;
  private endNotified = false;
  private listenersAttached = false;
  private readonly perf: PerfMonitor | null;

  constructor(private readonly options: GameSessionOptions) {
    this.world = new World(options.config, buildObstacles(ARENA_LAYOUT), new Rng(options.seed), ARENA_LAYOUT.playerSpawn);
    this.loop = new FixedStepLoop({
      stepSeconds: STEP_SECONDS,
      maxStepsPerFrame: MAX_STEPS_PER_FRAME,
      step: (dt) => stepSimulation(this.world, this.options.input, this.fireBuffer, dt),
      render: (alpha, frameSeconds) => this.renderFrame(alpha, frameSeconds),
    });
    this.keyboard = new KeyboardInput({
      input: options.input,
      onPauseKey: () => this.togglePause(),
      isActive: () => !this.paused && this.world.phase === 'running',
    });
    this.battleAudio = new BattleAudio(options.audio, new Rng(options.seed ^ 0xa5a5a5));
    this.perf = options.profile ? new PerfMonitor() : null;
    diagnostics.sessionsCreated++;
  }

  get perfSnapshot(): PerfSnapshot | null {
    return this.perf?.snapshot() ?? null;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get pixiApp(): Application | null {
    return this.app;
  }

  get rendererStats() {
    return this.renderer?.spriteCounts ?? null;
  }

  async mount(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
      autoDensity: true,
      antialias: true,
      backgroundColor: 0x0b1a2b,
      preference: 'webgl',
    });
    if (this.disposed) {
      app.destroy(true, { children: true });
      return;
    }
    this.app = app;
    app.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(app.canvas);

    this.renderer = new GameRenderer(this.world, ARENA_LAYOUT, this.options.textures, this.options.seed);
    app.stage.addChild(this.renderer.stage);
    this.resizeObserver = new ResizeObserver(() => this.resize(host));
    this.resizeObserver.observe(host);
    this.resize(host);

    this.keyboard.attach();
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.listenersAttached = true;
    // keydown + keyup + blur + visibilitychange + ticker
    diagnostics.attachedListeners += 5;

    this.publishHud();
    this.options.store.update({ phase: 'running' });
    this.battleAudio.start();
    this.renderFrame(0, 0);
    if (!this.options.manualClock) app.ticker.add(this.tick);
  }

  pause(reason: PauseReason): void {
    if (this.disposed || this.paused || this.world.phase !== 'running') return;
    this.paused = true;
    // Held keys and fire presses must not survive the pause.
    this.options.input.clear();
    this.loop.reset();
    this.app?.ticker.stop();
    this.battleAudio.pause();
    this.options.store.update({ phase: 'paused', pauseReason: reason });
  }

  resume(): void {
    if (this.disposed || !this.paused) return;
    this.paused = false;
    this.options.input.clear();
    this.loop.reset();
    this.battleAudio.resume();
    this.options.store.update({ phase: 'running', pauseReason: null });
    this.app?.ticker.start();
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause('manual');
  }

  /** Test-only manual clock: runs exactly the steps covering `seconds`. */
  advanceManually(seconds: number): void {
    if (this.disposed || this.paused) return;
    this.loop.runSteps(Math.round(seconds / STEP_SECONDS));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    diagnostics.sessionsDisposed++;
    if (this.listenersAttached) diagnostics.attachedListeners -= 5;
    this.keyboard.detach();
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.battleAudio.dispose();
    this.options.input.clear();
    if (this.app) {
      this.app.ticker.remove(this.tick);
      this.renderer?.destroy();
      this.app.destroy(true, { children: true });
    }
    this.renderer = null;
    this.app = null;
  }

  private readonly tick = (ticker: Ticker): void => {
    if (this.disposed || this.paused) return;
    this.loop.advance(ticker.deltaMS / 1000);
    if (this.perf && this.renderer && this.world.phase === 'running') {
      const stats = this.renderer.spriteCounts;
      this.perf.recordFrame(ticker.deltaMS, {
        ships: this.world.ships.length,
        projectiles: this.world.projectiles.length,
        effects: stats.effects,
        wrecks: stats.wrecks,
      });
    }
  };

  private readonly handleBlur = (): void => this.pause('focus-lost');

  private readonly handleVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.pause('focus-lost');
  };

  private resize(host: HTMLElement): void {
    if (!this.app || !this.renderer) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.app.renderer.resize(width, height);
    this.renderer.resize(width, height);
  }

  private renderFrame(alpha: number, frameSeconds: number): void {
    const renderer = this.renderer;
    if (!renderer) return;
    const events = this.world.events;
    if (events.length > 0) {
      renderer.handleEvents(events);
      this.battleAudio.handleEvents(events, this.world);
      events.length = 0;
    }
    this.battleAudio.update(this.world);
    renderer.render(alpha, frameSeconds);
    this.publishHud();
    if (this.world.phase === 'ended' && !this.endNotified) {
      this.endNotified = true;
      if (this.perf) diagnostics.reports.push(this.perf.report(this.world.elapsed));
      this.options.store.update({ phase: 'ended', endReason: this.world.endReason });
      this.options.onEnded({
        score: this.world.score,
        durationSeconds: this.world.elapsed,
        endReason: this.world.endReason ?? 'time_up',
      });
    }
  }

  private publishHud(): void {
    const player = this.world.player;
    this.options.store.update({
      health: player.health,
      maxHealth: player.config.maxHealth,
      score: this.world.score,
      secondsLeft: Math.ceil(this.world.remainingSeconds - 1e-9),
    });
  }
}
