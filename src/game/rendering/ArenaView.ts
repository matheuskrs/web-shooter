import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { TILE, TILE_SIZE, type IslandLayout, type SceneryLayout } from '../arena/arenaLayout';
import type { GameTextures } from '../assets/AssetLoader';
import type { GeneratedTextures } from './GeneratedTextures';

/** A thin, quiet line marks where the arena ends; the sea itself is not darkened. */
const BOUNDARY_COLOR = 0xffffff;
const BOUNDARY_ALPHA = 0.28;
const BOUNDARY_WIDTH = 2;
/** The shimmer layer trails the camera slightly, a cheap hint of depth while travelling. */
const SHIMMER_PARALLAX = 0.12;

/** Per-frame values shared by every scene, so water and parallax stay continuous across scene swaps. */
export interface AmbientFrame {
  /** Seconds of ambient (water) time; shared by all scenes. */
  time: number;
  cameraX: number;
  cameraY: number;
}

export interface ArenaViewOptions {
  bounds: { width: number; height: number };
  layout: SceneryLayout;
  /**
   * How far the sea extends past `bounds`. Kept a multiple of the tile size
   * so the water of different scenes lines up when the camera swaps them.
   */
  seaMargin: number;
  /** Draw the edge of `bounds`: the limit of a match arena. */
  showBoundary: boolean;
}

/**
 * Static scenery built from the official tiles. Only the two water layers
 * move: they drift slowly in opposite directions for a cheap shimmer.
 */
export class ArenaView {
  readonly container = new Container();
  private readonly water: TilingSprite;
  private readonly shimmer: TilingSprite;
  private readonly boundary: Graphics | null;

  constructor(options: ArenaViewOptions, textures: GameTextures, generated: GeneratedTextures) {
    const { bounds, layout, seaMargin } = options;
    const waterTexture = textures.tile(TILE.water);
    const seaSize = { width: bounds.width + seaMargin * 2, height: bounds.height + seaMargin * 2 };
    this.water = new TilingSprite({ texture: waterTexture, ...seaSize });
    this.water.position.set(-seaMargin, -seaMargin);
    this.shimmer = new TilingSprite({ texture: waterTexture, ...seaSize });
    this.shimmer.position.set(-seaMargin, -seaMargin);
    this.shimmer.tileScale.set(1.7);
    this.shimmer.alpha = 0.16;
    this.container.addChild(this.water, this.shimmer);

    for (const island of layout.islands) {
      const view = buildIsland(island, textures);
      // Baking each island at the tiles' native 2x resolution places every tile on
      // exact texels, which removes the hairline seams linear filtering draws
      // between adjacent tiles at fractional canvas scales.
      view.cacheAsTexture({ resolution: 2, antialias: false });
      this.container.addChild(view);
    }
    for (const rock of layout.rocks) {
      const foam = new Sprite({ texture: generated.glow, anchor: 0.5, alpha: 0.35 });
      foam.position.set(rock.x, rock.y);
      foam.scale.set((rock.radius * 3.2) / 32);
      const sprite = new Sprite({ texture: textures.tile(rock.tile), anchor: 0.5 });
      sprite.position.set(rock.x, rock.y);
      this.container.addChild(foam, sprite);
    }
    for (const prop of layout.props ?? []) {
      const texture = prop.frame ? textures.ships[prop.frame] : prop.tile !== undefined ? textures.tile(prop.tile) : undefined;
      if (!texture) continue;
      const sprite = new Sprite({ texture, anchor: 0.5 });
      sprite.position.set(prop.x, prop.y);
      sprite.rotation = prop.rotation ?? 0;
      sprite.scale.set(prop.scale ?? 1);
      sprite.alpha = prop.alpha ?? 1;
      this.container.addChild(sprite);
    }

    this.boundary = options.showBoundary ? buildBoundaryLine(bounds) : null;
    if (this.boundary) this.container.addChild(this.boundary);
  }

  update(ambient: AmbientFrame): void {
    const t = ambient.time;
    this.water.tilePosition.set(t * 6, t * 3);
    this.shimmer.tilePosition.set(-t * 9 + ambient.cameraX * SHIMMER_PARALLAX, t * 5 + ambient.cameraY * SHIMMER_PARALLAX);
  }

  /** Fades the arena edge in after the camera arrives from the open sea. */
  setBoundaryAlpha(alpha: number): void {
    if (this.boundary) this.boundary.alpha = alpha;
  }
}

function placeTile(target: Container, textures: GameTextures, id: number, x: number, y: number): void {
  const sprite = new Sprite(textures.tile(id));
  sprite.position.set(x, y);
  target.addChild(sprite);
}

/** Picks the 3x3 nine-slice tile for a cell of a w x h rectangle. */
function nineSlice<T>(set: { topLeft: T; top: T; topRight: T; left: T; center: T; right: T; bottomLeft: T; bottom: T; bottomRight: T }, col: number, row: number, w: number, h: number): T {
  const top = row === 0;
  const bottom = row === h - 1;
  const left = col === 0;
  const right = col === w - 1;
  if (top) return left ? set.topLeft : right ? set.topRight : set.top;
  if (bottom) return left ? set.bottomLeft : right ? set.bottomRight : set.bottom;
  return left ? set.left : right ? set.right : set.center;
}

function buildIsland(island: IslandLayout, textures: GameTextures): Container {
  const container = new Container();
  const originX = island.tileX * TILE_SIZE;
  const originY = island.tileY * TILE_SIZE;

  // Translucent shallow-water ring one tile wider than the island on each side.
  const ringW = island.tilesWide + 2;
  const ringH = island.tilesHigh + 2;
  for (let row = 0; row < ringH; row++) {
    for (let col = 0; col < ringW; col++) {
      placeTile(container, textures, nineSlice(TILE.shallow, col, row, ringW, ringH), originX + (col - 1) * TILE_SIZE, originY + (row - 1) * TILE_SIZE);
    }
  }

  for (let row = 0; row < island.tilesHigh; row++) {
    for (let col = 0; col < island.tilesWide; col++) {
      const id =
        island.style === 'grass'
          ? (TILE.grassIsland[row]?.[col] ?? TILE.sand.center)
          : nineSlice(TILE.sand, col, row, island.tilesWide, island.tilesHigh);
      placeTile(container, textures, id, originX + col * TILE_SIZE, originY + row * TILE_SIZE);
    }
  }

  for (const decoration of island.decorations) {
    const sprite = new Sprite({ texture: textures.tile(decoration.tile), anchor: 0.5 });
    sprite.position.set(originX + decoration.x, originY + decoration.y);
    sprite.scale.set(decoration.scale ?? 1);
    sprite.rotation = decoration.rotation ?? 0;
    container.addChild(sprite);
  }
  return container;
}

function buildBoundaryLine(bounds: { width: number; height: number }): Graphics {
  return new Graphics()
    .rect(0, 0, bounds.width, bounds.height)
    .stroke({ color: BOUNDARY_COLOR, alpha: BOUNDARY_ALPHA, width: BOUNDARY_WIDTH, alignment: 1 });
}
