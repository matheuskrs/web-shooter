import type { Container } from 'pixi.js';
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
import type { AmbientFrame } from '../rendering/ArenaView';
import { GameRenderer } from '../rendering/GameRenderer';
import type { EndReason } from '../simulation/events';
import { stepSimulation } from '../simulation/stepSimulation';
import { World } from '../simulation/World';
import { createFireBuffer } from '../systems/playerControlSystem';
import { FixedStepLoop } from './FixedStepLoop';

export const STEP_SECONDS = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
/** Sea drawn around the arena; a tile multiple so it lines up with the menu world's water. */
const SEA_MARGIN = 19 * 64;

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

type SessionState = 'created' | 'running' | 'halted' | 'disposed';

/**
 * One match: its world, fixed-step loop, input bindings and audio voices,
 * drawn into `root`. The long-lived WorldHost owns the Pixi application and
 * the camera; it calls `begin()` when the PLAY camera lands on the arena,
 * `update()` every frame, and `dispose()` once the camera has left again.
 *
 *   created ──begin()──► running ──halt()──► halted ──dispose()──► disposed
 *
 * Before `begin()` the world is drawn but frozen; after `halt()` (leaving
 * the battle) input, audio and simulation stop at once while the visuals stay
 * on screen until the camera swaps them out. `dispose()` is idempotent.
 */
export class GameSession {
  readonly world: World;
  readonly root: Container;
  private readonly loop: FixedStepLoop;
  private readonly keyboard: KeyboardInput;
  private readonly battleAudio: BattleAudio;
  private readonly renderer: GameRenderer;
  private readonly fireBuffer = createFireBuffer();
  private readonly perf: PerfMonitor | null;
  private state: SessionState = 'created';
  private paused = false;
  private endNotified = false;
  private ambient: AmbientFrame = { time: 0, cameraX: 0, cameraY: 0 };
  private lastFrameMs = 0;

  constructor(private readonly options: GameSessionOptions) {
    this.world = new World(options.config, buildObstacles(ARENA_LAYOUT), new Rng(options.seed), ARENA_LAYOUT.playerSpawn);
    this.renderer = new GameRenderer(this.world, options.textures, {
      layout: ARENA_LAYOUT,
      seed: options.seed,
      seaMargin: SEA_MARGIN,
      showBoundary: true,
      shake: true,
    });
    this.root = this.renderer.stage;
    this.loop = new FixedStepLoop({
      stepSeconds: STEP_SECONDS,
      maxStepsPerFrame: MAX_STEPS_PER_FRAME,
      step: (dt) => stepSimulation(this.world, this.options.input, this.fireBuffer, dt),
      render: (alpha, frameSeconds) => this.renderFrame(alpha, frameSeconds),
    });
    this.keyboard = new KeyboardInput({
      input: options.input,
      onPauseKey: () => this.togglePause(),
      isActive: () => this.state === 'running' && !this.paused && this.world.phase === 'running',
    });
    this.battleAudio = new BattleAudio(options.audio, new Rng(options.seed ^ 0xa5a5a5));
    this.perf = options.profile ? new PerfMonitor() : null;
    diagnostics.sessionsCreated++;
    this.publishHud();
    this.renderFrame(0, 0);
  }

  get perfSnapshot(): PerfSnapshot | null {
    return this.perf?.snapshot() ?? null;
  }

  get isDisposed(): boolean {
    return this.state === 'disposed';
  }

  /** True once the camera has landed and the player is in control. */
  get isRunning(): boolean {
    return this.state === 'running';
  }

  get rendererStats() {
    return this.state === 'disposed' ? null : this.renderer.spriteCounts;
  }

  setBoundaryAlpha(alpha: number): void {
    if (this.state !== 'disposed') this.renderer.setBoundaryAlpha(alpha);
  }

  /** Hands control to the player: input, pause triggers, audio and the clock start now. */
  begin(): void {
    if (this.state !== 'created') return;
    this.state = 'running';
    this.keyboard.attach();
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
    // keydown + keyup + blur + visibilitychange
    diagnostics.attachedListeners += 4;
    this.loop.reset();
    this.battleAudio.start();
    this.options.store.update({ phase: 'running' });
  }

  /** Called by the host's ticker every frame while this session is on screen. */
  update(frameSeconds: number, ambient: AmbientFrame): void {
    this.ambient = ambient;
    this.lastFrameMs = frameSeconds * 1000;
    if (this.state === 'disposed' || this.paused) return;
    if (this.state !== 'running' || this.options.manualClock) {
      // Frozen world (before begin, after halt, or driven by the test clock):
      // redraw for the camera without simulating. Under the test clock effects
      // only advance with `advanceManually`, keeping screenshots deterministic.
      const cosmeticSeconds = this.state === 'created' && !this.options.manualClock ? frameSeconds : 0;
      this.renderer.render(0, cosmeticSeconds, ambient);
      return;
    }
    this.loop.advance(frameSeconds);
    if (this.perf && this.world.phase === 'running') {
      const stats = this.renderer.spriteCounts;
      this.perf.recordFrame(this.lastFrameMs, {
        ships: this.world.ships.length,
        projectiles: this.world.projectiles.length,
        effects: stats.effects,
        wrecks: stats.wrecks,
      });
    }
  }

  pause(reason: PauseReason): void {
    if (this.state !== 'running' || this.paused || this.world.phase !== 'running') return;
    this.paused = true;
    // Held keys and fire presses must not survive the pause.
    this.options.input.clear();
    this.loop.reset();
    this.battleAudio.pause();
    this.options.store.update({ phase: 'paused', pauseReason: reason });
  }

  resume(): void {
    if (this.state !== 'running' || !this.paused) return;
    this.paused = false;
    this.options.input.clear();
    this.loop.reset();
    this.battleAudio.resume();
    this.options.store.update({ phase: 'running', pauseReason: null });
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause('manual');
  }

  /** Test-only manual clock: runs exactly the steps covering `seconds`. */
  advanceManually(seconds: number): void {
    if (this.state !== 'running' || this.paused) return;
    this.loop.runSteps(Math.round(seconds / STEP_SECONDS));
  }

  /** Leaving the battle: stop everything interactive now, keep the picture until the camera swaps it out. */
  halt(): void {
    if (this.state === 'halted' || this.state === 'disposed') return;
    if (this.state === 'running') {
      this.keyboard.detach();
      window.removeEventListener('blur', this.handleBlur);
      document.removeEventListener('visibilitychange', this.handleVisibility);
      diagnostics.attachedListeners -= 4;
    }
    this.state = 'halted';
    this.paused = false;
    this.battleAudio.dispose();
    this.options.input.clear();
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    this.halt();
    this.state = 'disposed';
    diagnostics.sessionsDisposed++;
    // Sprites and the session's own generated textures go; shared atlas textures stay.
    this.renderer.destroy();
  }

  private readonly handleBlur = (): void => this.pause('focus-lost');

  private readonly handleVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.pause('focus-lost');
  };

  private renderFrame(alpha: number, frameSeconds: number): void {
    const events = this.world.events;
    if (events.length > 0) {
      this.renderer.handleEvents(events);
      this.battleAudio.handleEvents(events, this.world);
      events.length = 0;
    }
    this.battleAudio.update(this.world);
    this.renderer.render(alpha, frameSeconds, this.ambient);
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
    const player = this.world.requirePlayer();
    this.options.store.update({
      health: player.health,
      maxHealth: player.config.maxHealth,
      score: this.world.score,
      secondsLeft: Math.ceil(this.world.remainingSeconds - 1e-9),
    });
  }
}
