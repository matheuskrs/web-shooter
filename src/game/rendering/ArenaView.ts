import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { TILE, TILE_SIZE, type ArenaLayout, type IslandLayout } from '../arena/arenaLayout';
import type { ArenaConfig } from '../config/gameConfig';
import type { GameTextures } from '../assets/AssetLoader';
import type { GeneratedTextures } from './GeneratedTextures';

/** Water extends this far past the arena so letterbox space shows sea, not a flat colour. */
const SEA_MARGIN = 1200;
const OUTSIDE_TINT = 0x0b1a2b;
const OUTSIDE_ALPHA = 0.5;

/**
 * Static scenery built from the official tiles. Only the two water layers
 * move: they drift slowly in opposite directions for a cheap shimmer.
 */
export class ArenaView {
  readonly container = new Container();
  private readonly water: TilingSprite;
  private readonly shimmer: TilingSprite;
  private time = 0;

  constructor(
    arena: ArenaConfig,
    layout: ArenaLayout,
    textures: GameTextures,
    generated: GeneratedTextures,
  ) {
    const waterTexture = textures.tile(TILE.water);
    const seaSize = { width: arena.width + SEA_MARGIN * 2, height: arena.height + SEA_MARGIN * 2 };
    this.water = new TilingSprite({ texture: waterTexture, ...seaSize });
    this.water.position.set(-SEA_MARGIN, -SEA_MARGIN);
    this.shimmer = new TilingSprite({ texture: waterTexture, ...seaSize });
    this.shimmer.position.set(-SEA_MARGIN, -SEA_MARGIN);
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
    this.container.addChild(buildOutsideShade(arena));
  }

  update(dt: number): void {
    this.time += dt;
    this.water.tilePosition.set(this.time * 6, this.time * 3);
    this.shimmer.tilePosition.set(-this.time * 9, this.time * 5);
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
      let id: number;
      if (island.style === 'grass') {
        id = TILE.grassIsland[row]?.[col] ?? TILE.sand.center;
      } else {
        id = nineSlice(TILE.sand, col, row, island.tilesWide, island.tilesHigh);
      }
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

/** Darkens the sea outside the playable rectangle so the boundary reads clearly. */
function buildOutsideShade(arena: ArenaConfig): Graphics {
  const m = SEA_MARGIN;
  return new Graphics()
    .rect(-m, -m, arena.width + m * 2, m)
    .rect(-m, arena.height, arena.width + m * 2, m)
    .rect(-m, 0, m, arena.height)
    .rect(arena.width, 0, m, arena.height)
    .fill({ color: OUTSIDE_TINT, alpha: OUTSIDE_ALPHA })
    .rect(0, 0, arena.width, arena.height)
    .stroke({ color: 0xffffff, alpha: 0.18, width: 3, alignment: 1 });
}
