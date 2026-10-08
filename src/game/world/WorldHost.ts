import { Application, Container, type Ticker } from 'pixi.js';
import { MotionBlurFilter } from 'pixi-filters/motion-blur';
import { ARENA_LAYOUT } from '../arena/arenaLayout';
import type { AssetLoader } from '../assets/AssetLoader';
import type { AudioManager } from '../audio/AudioManager';
import { GameUiStore } from '../bridge/GameUiStore';
import type { GameConfig } from '../config/gameConfig';
import { GameSession, type MatchOutcome } from '../core/GameSession';
import { perfModeEnabled } from '../diagnostics/diagnostics';
import { InputState } from '../input/InputState';
import type { AmbientFrame } from '../rendering/ArenaView';
import { trackSession, trackWorld } from '../testing/testApi';
import { AttractScene } from './AttractScene';
import { ARENA_ORIGIN, LOCATIONS, type WorldLocation } from './attractLayout';
import { CameraDirector } from './CameraDirector';
import { CAMERA_TIMING, cameraDuration, motionMode, type MotionMode } from './motion';

/** At zoom 1 the camera frames this many world units: exactly one match arena. */
const FRAME_WIDTH = 1600;
const FRAME_HEIGHT = 900;
const MAX_RESOLUTION = 2;
/** World speed (screen px/s) below which no blur is drawn: idle drift never blurs. */
const BLUR_MIN_SPEED = 300;
/** Blur streak length = speed × this, capped: scenery should streak, not smear. */
const BLUR_SECONDS = 0.009;
const BLUR_MAX_PX = 24;
/** Samples along the streak; touch devices get fewer to keep the travel frames cheap. */
const BLUR_KERNEL = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 9 : 15;
const MENU_ZOOM_DIP = 0.35;
const PLAY_ZOOM_DIP = 0.45;
const PLAY_CLOSE_UP_ZOOM = 1.9;
const BOUNDARY_FADE_SECONDS = 0.6;

export interface MatchSetup {
  matchId: string;
  seed: number;
  options: { sessionSeconds: number; spawnIntervalSeconds: number };
  config: GameConfig;
}

/** What the React layer needs to drive one match's HUD and controls. */
export interface MatchRuntime {
  matchId: string;
  store: GameUiStore;
  input: InputState;
  session: GameSession;
}

export interface WorldHostOptions {
  assets: AssetLoader;
  audio: AudioManager;
  /** Fixed seed (tests); otherwise random per page. */
  seed: number | null;
  manualClock: boolean;
}

/**
 * The one Pixi application of the page, alive for as long as the page is.
 * It always shows one continuous sea: the menu's attract world, or a match
 * world placed at the same spot where the arena islands sit in the menu
 * world. A single CameraDirector frames it; switching between the two worlds
 * happens at the midpoint of a camera move, under motion blur, so the swap
 * reads as travelling rather than loading.
 *
 * Ownership: the host owns the application, its single ticker callback and
 * the attract scene; each match's GameSession is created by `startMatch`
 * and disposed by the host as soon as the camera has left it.
 */
export class WorldHost {
  readonly camera = new CameraDirector();
  private app: Application | null = null;
  private appReady: Promise<Application> | null = null;
  /** Screen space: holds the camera-transformed world; the motion blur is applied here. */
  private readonly viewport = new Container();
  /** World space: the camera transform lives on this container. */
  private readonly worldRoot = new Container();
  private readonly blur = new MotionBlurFilter({ velocity: { x: 0, y: 0 }, kernelSize: BLUR_KERNEL });
  private attract: AttractScene | null = null;
  private match: MatchRuntime | null = null;
  /** Halted sessions still on screen until the camera swaps them out. */
  private readonly outgoing = new Set<GameSession>();
  private readonly untrack = new Map<GameSession, () => void>();
  private location: WorldLocation = 'menu';
  private ambientTime = 0;
  private boundaryFade: { session: GameSession; seconds: number } | null = null;
  private element: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly seed: number;
  /** A match id is played at most once, even if the browser history leads back to it. */
  private readonly playedMatchIds = new Set<string>();
  private readonly listeners = new Set<() => void>();
  /** React panels placed at world locations; their CSS transform follows the camera. */
  private readonly anchoredUi = new Map<HTMLElement, { location: WorldLocation; transform: string }>();
  private wasTravelling = false;

  constructor(private readonly options: WorldHostOptions) {
    this.seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.camera.placeAt(LOCATIONS.menu, motionMode() === 'full');
    trackWorld(() => ({
      attractShips: this.attractShipCount,
      camera: { ...this.camera.pose },
      travelling: this.camera.isTravelling,
      activeMatchId: this.activeMatchId,
    }));
  }

  get activeMatchId(): string | null {
    return this.match?.matchId ?? null;
  }

  /** React reads the active match through `useSyncExternalStore(subscribe, getRuntime)`. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getRuntime = (): MatchRuntime | null => this.match;

  readonly getTravelling = (): boolean => this.camera.isTravelling;

  /**
   * Places a DOM element at a world location: every frame its transform is
   * set from the camera, so the panel zooms and travels with the sea instead
   * of fading in on arrival. At the location's own zoom it renders 1:1.
   * Direct style writes, so React does not re-render for camera motion.
   */
  attachUi(element: HTMLElement, location: WorldLocation): () => void {
    this.anchoredUi.set(element, { location, transform: '' });
    this.positionUi(element);
    return () => {
      this.anchoredUi.delete(element);
    };
  }

  hasPlayed(matchId: string): boolean {
    return this.playedMatchIds.has(matchId);
  }

  canStart(matchId: string): boolean {
    return !this.playedMatchIds.has(matchId) && this.options.assets.getState().status === 'ready';
  }

  get attractShipCount(): number {
    return this.attract?.shipCount ?? 0;
  }

  /** Attach the canvas to a DOM node. Idempotent; safe under React Strict Mode. */
  mount(element: HTMLElement): void {
    this.element = element;
    void this.ensureApp().then((app) => {
      if (this.element !== element) return;
      element.appendChild(app.canvas);
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(element);
      this.resize();
    });
  }

  unmount(element: HTMLElement): void {
    if (this.element !== element) return;
    this.element = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.app?.canvas.remove();
  }

  /** Builds the menu world once the shared textures are loaded. */
  ensureAttract(): void {
    if (this.attract || !this.app || this.options.assets.getState().status !== 'ready') return;
    this.attract = new AttractScene(this.options.assets.textures, this.seed, LOCATIONS[this.location]);
    this.attract.root.visible = this.match === null;
    this.worldRoot.addChildAt(this.attract.root, 0);
  }

  /**
   * Point the camera at a menu location. Leaving a match halts it at once
   * (no input, audio or simulation) and disposes it at the travel midpoint.
   */
  focus(location: WorldLocation): void {
    if (location === 'arena' && this.match) return;
    const leaving = this.match;
    if (!leaving && location === this.location) return;

    this.location = location;
    this.match = null;
    if (leaving) this.notify();
    const anchor = LOCATIONS[location];
    this.attract?.setFocus(anchor);
    if (leaving) {
      leaving.session.halt();
      // The arena edge belongs to the battle; it must not linger while the camera flies off.
      leaving.session.setBoundaryAlpha(0);
      this.outgoing.add(leaving.session);
    }
    const swap = () => {
      if (leaving) this.removeSession(leaving.session);
      this.showAttract(true);
    };
    const mode = motionMode();
    const drift = mode === 'full' && location !== 'arena';
    const duration = cameraDuration(CAMERA_TIMING.travelMs, mode);
    if (duration === 0) {
      this.camera.placeAt(anchor, drift);
      swap();
      return;
    }
    this.camera.travel([{ to: anchor, durationMs: duration, zoomDip: MENU_ZOOM_DIP, ease: 'inOut', onMidpoint: swap }], drift);
    this.syncTravelling();
  }

  /**
   * PLAY: fly from wherever the camera is to the player's ship, swap the
   * menu world for the new match world mid-flight, close in on the ship and
   * settle into the full-arena battle framing. Control starts on landing.
   * Idempotent per match id.
   */
  startMatch(setup: MatchSetup, onEnded: (outcome: MatchOutcome) => void): MatchRuntime | null {
    if (this.match?.matchId === setup.matchId) return this.match;
    if (!this.canStart(setup.matchId)) return null;
    this.playedMatchIds.add(setup.matchId);
    const store = new GameUiStore();
    const input = new InputState();
    const session = new GameSession({
      config: setup.config,
      seed: setup.seed,
      textures: this.options.assets.textures,
      audio: this.options.audio,
      store,
      input,
      manualClock: this.options.manualClock,
      profile: perfModeEnabled,
      onEnded,
    });
    session.root.position.set(ARENA_ORIGIN.x, ARENA_ORIGIN.y);
    session.root.visible = false;
    session.setBoundaryAlpha(0);
    this.worldRoot.addChild(session.root);
    this.untrack.set(session, trackSession(session));

    const previous = this.match;
    if (previous) {
      previous.session.halt();
      previous.session.setBoundaryAlpha(0);
      this.outgoing.add(previous.session);
    }
    const runtime: MatchRuntime = { matchId: setup.matchId, store, input, session };
    this.match = runtime;
    this.location = 'arena';
    this.notify();
    this.attract?.setFocus(LOCATIONS.arena);

    const swap = () => {
      if (previous) this.removeSession(previous.session);
      this.showAttract(false);
      session.root.visible = true;
      this.boundaryFade = { session, seconds: 0 };
    };
    const land = () => {
      if (this.match !== runtime) return;
      session.setBoundaryAlpha(1);
      this.boundaryFade = null;
      session.begin();
    };

    const mode = motionMode();
    const travelMs = cameraDuration(previous ? CAMERA_TIMING.replayTravelMs : CAMERA_TIMING.playTravelMs, mode);
    if (travelMs === 0) {
      this.camera.placeAt(LOCATIONS.arena, false);
      swap();
      land();
      return runtime;
    }
    const spawn = ARENA_LAYOUT.playerSpawn;
    this.camera.travel(
      [
        {
          to: { x: ARENA_ORIGIN.x + spawn.x, y: ARENA_ORIGIN.y + spawn.y, zoom: PLAY_CLOSE_UP_ZOOM },
          durationMs: travelMs,
          zoomDip: previous ? 0.12 : PLAY_ZOOM_DIP,
          ease: 'inOut',
          onMidpoint: swap,
        },
        { to: LOCATIONS.arena, durationMs: CAMERA_TIMING.playSettleMs, zoomDip: 0, ease: 'out', onArrive: land },
      ],
      false,
    );
    this.syncTravelling();
    return runtime;
  }

  private async ensureApp(): Promise<Application> {
    this.appReady ??= (async () => {
      const app = new Application();
      await app.init({
        width: 1,
        height: 1,
        resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
        autoDensity: true,
        antialias: true,
        // Transparent until the sea is drawn, so the painted CSS backdrop shows while assets load.
        backgroundAlpha: 0,
        preference: 'webgl',
      });
      app.canvas.setAttribute('aria-hidden', 'true');
      this.viewport.addChild(this.worldRoot);
      app.stage.addChild(this.viewport);
      app.ticker.add(this.tick);
      this.app = app;
      this.ensureAttract();
      return app;
    })();
    return this.appReady;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private syncTravelling(): void {
    if (this.camera.isTravelling === this.wasTravelling) return;
    this.wasTravelling = this.camera.isTravelling;
    this.notify();
  }

  private viewScale(): number {
    const width = this.app?.screen.width ?? window.innerWidth;
    const height = this.app?.screen.height ?? window.innerHeight;
    return Math.min(width / FRAME_WIDTH, height / FRAME_HEIGHT);
  }

  private positionUi(element: HTMLElement): void {
    const entry = this.anchoredUi.get(element);
    if (!entry) return;
    const anchor = LOCATIONS[entry.location];
    const pose = this.camera.pose;
    // The panel sits above the sea: it follows travel and zoom, but not idle drift.
    const cameraX = pose.x - this.camera.driftOffset.x;
    const cameraY = pose.y - this.camera.driftOffset.y;
    const scale = this.viewScale() * pose.zoom;
    const dx = (anchor.x - cameraX) * scale;
    const dy = (anchor.y - cameraY) * scale;
    const size = pose.zoom / anchor.zoom;
    // No visibility toggling for panels outside the view: an arriving screen
    // must stay focusable while it is still far away.
    const transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${size.toFixed(4)})`;
    if (transform === entry.transform) return;
    entry.transform = transform;
    element.style.transform = transform;
  }

  private resize(): void {
    if (!this.app || !this.element) return;
    this.app.renderer.resize(Math.max(1, this.element.clientWidth), Math.max(1, this.element.clientHeight));
  }

  private showAttract(visible: boolean): void {
    if (this.attract) this.attract.root.visible = visible;
  }

  private removeSession(session: GameSession): void {
    this.outgoing.delete(session);
    session.dispose();
    this.untrack.get(session)?.();
    this.untrack.delete(session);
    if (this.boundaryFade?.session === session) this.boundaryFade = null;
  }

  private readonly tick = (ticker: Ticker): void => {
    const app = this.app;
    if (!app) return;
    const mode = motionMode();
    const realSeconds = ticker.deltaMS / 1000;
    // A hidden tab can hand back a huge delta; cosmetic time never jumps more than a frame or two.
    const frameSeconds = Math.min(realSeconds, 0.1);
    const cosmeticSeconds = mode === 'instant' ? 0 : frameSeconds;
    this.ambientTime += cosmeticSeconds;

    const { width, height } = app.screen;
    const baseScale = Math.min(width / FRAME_WIDTH, height / FRAME_HEIGHT);
    this.camera.update(frameSeconds, baseScale);
    const pose = this.camera.pose;
    const scale = baseScale * pose.zoom;
    this.worldRoot.scale.set(scale);
    this.worldRoot.position.set(width / 2 - pose.x * scale, height / 2 - pose.y * scale);
    this.applyMotionBlur(mode, app);
    for (const element of this.anchoredUi.keys()) this.positionUi(element);
    this.syncTravelling();

    if (this.boundaryFade) {
      this.boundaryFade.seconds += frameSeconds;
      this.boundaryFade.session.setBoundaryAlpha(Math.min(1, this.boundaryFade.seconds / BOUNDARY_FADE_SECONDS));
    }

    const ambient: AmbientFrame = { time: this.ambientTime, cameraX: pose.x, cameraY: pose.y };
    if (this.attract?.root.visible) this.attract.update(cosmeticSeconds, ambient);
    for (const session of this.outgoing) session.update(0, ambient);
    this.match?.session.update(realSeconds, ambient);
  };

  /**
   * Directional blur only while the world sweeps fast across the screen;
   * otherwise the filter is detached so idle frames cost nothing extra.
   */
  private applyMotionBlur(mode: MotionMode, app: Application): void {
    const velocity = this.camera.screenVelocity;
    const speed = Math.hypot(velocity.x, velocity.y);
    if (mode !== 'full' || speed < BLUR_MIN_SPEED) {
      if (this.viewport.filters) this.viewport.filters = null;
      return;
    }
    const length = Math.min(BLUR_MAX_PX, (speed - BLUR_MIN_SPEED) * BLUR_SECONDS);
    this.blur.velocity = { x: (velocity.x / speed) * length, y: (velocity.y / speed) * length };
    if (!this.viewport.filters) {
      // filterArea is in the container's local space; the viewport's local space is the screen.
      this.viewport.filterArea = app.screen;
      this.viewport.filters = [this.blur];
    }
  }
}
