import { Assets, Rectangle, Spritesheet, Texture, type UnresolvedAsset } from 'pixi.js';
import type { AudioManager } from '../audio/AudioManager';
import { TILE_SIZE } from '../arena/arenaLayout';
import {
  SHIPS_SHEET_XML,
  SOUND_URLS,
  TEXTURE_ASSETS,
  TEXTURE_RESOLUTION,
  type TextureAssetKey,
} from './assetManifest';
import { parseStarlingAtlas } from './starlingAtlas';

export interface GameTextures {
  /** Frames of the ships atlas by name, e.g. "ship_3", "cannon_ball", "explosion_1". */
  ships: Readonly<Record<string, Texture>>;
  tile(id: number): Texture;
  healthFrame: Texture;
  healthFillRed: Texture;
  healthFillGreen: Texture;
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LoaderState {
  status: LoadStatus;
  /** 0..1 */
  progress: number;
  error: string | null;
}

const TILE_COLUMNS = 16;
const TEXTURE_WEIGHT = 0.7;

/**
 * Loads and owns the battle's shared textures. Textures are created once per
 * page and reused by every match and every sprite; sessions destroy their
 * sprites but never these textures.
 *
 * Exposes its state through subscribe/getState so React can render progress
 * and a retry button without owning any loading logic. A failed load resets
 * to "error" and the next `load()` starts over (Pixi evicts failed URLs from
 * its cache, so the retry really hits the network again).
 */
export class AssetLoader {
  private state: LoaderState = { status: 'idle', progress: 0, error: null };
  private readonly listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  private loadedTextures: GameTextures | null = null;

  constructor(private readonly audio: AudioManager) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getState = (): LoaderState => this.state;

  get textures(): GameTextures {
    if (!this.loadedTextures) throw new Error('Game textures requested before loading finished');
    return this.loadedTextures;
  }

  load(): Promise<void> {
    if (this.state.status === 'ready') return Promise.resolve();
    this.loading ??= this.loadAll().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async loadAll(): Promise<void> {
    this.setState({ status: 'loading', progress: 0, error: null });
    const soundNames = Object.keys(SOUND_URLS);
    let soundsDone = 0;
    let textureProgress = 0;
    const report = () =>
      this.setState({
        ...this.state,
        progress: textureProgress * TEXTURE_WEIGHT + (soundsDone / Math.max(1, soundNames.length)) * (1 - TEXTURE_WEIGHT),
      });

    try {
      const [sources] = await Promise.all([
        Assets.load<Texture>(textureDescriptors(), (progress) => {
          textureProgress = progress;
          report();
        }),
        this.audio.preload(soundNames, () => {
          soundsDone++;
          report();
        }),
      ]);
      this.loadedTextures ??= await buildTextures(sources);
      this.setState({ status: 'ready', progress: 1, error: null });
    } catch (error) {
      this.setState({
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown loading error',
      });
    }
  }

  private setState(next: LoaderState): void {
    this.state = next;
    for (const listener of this.listeners) listener();
  }
}

function aliasOf(key: TextureAssetKey): string {
  return `pirate-battle:${key}`;
}

function textureDescriptors(): UnresolvedAsset[] {
  return (Object.keys(TEXTURE_ASSETS) as TextureAssetKey[]).map((key) => ({
    alias: aliasOf(key),
    src: TEXTURE_ASSETS[key],
    data: { resolution: TEXTURE_RESOLUTION[key] },
  }));
}

async function buildTextures(sources: Record<string, Texture>): Promise<GameTextures> {
  const get = (key: TextureAssetKey): Texture => {
    const texture = sources[aliasOf(key)];
    if (!texture) throw new Error(`Missing texture ${key}`);
    return texture;
  };

  const shipsSheet = new Spritesheet(get('shipsSheet'), parseStarlingAtlas(SHIPS_SHEET_XML, 'ships_miscellaneous_sheet.png'));
  const ships = await shipsSheet.parse();

  const tilesSource = get('tilesSheet').source;
  const tiles = new Map<number, Texture>();
  const tile = (id: number): Texture => {
    let texture = tiles.get(id);
    if (!texture) {
      const index = id - 1;
      texture = new Texture({
        source: tilesSource,
        frame: new Rectangle((index % TILE_COLUMNS) * TILE_SIZE, Math.floor(index / TILE_COLUMNS) * TILE_SIZE, TILE_SIZE, TILE_SIZE),
      });
      tiles.set(id, texture);
    }
    return texture;
  };

  return {
    ships,
    tile,
    healthFrame: get('enemyHealthFrame'),
    healthFillRed: get('enemyHealthFillRed'),
    healthFillGreen: get('enemyHealthFillGreen'),
  };
}
