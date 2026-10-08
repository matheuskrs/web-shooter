import type { ObstacleShape } from '../collision/geometry';

export const TILE_SIZE = 64;

/** Tile ids refer to `tile_<id>.png` (row-major in the 16-column tilesheet). */
export const TILE = {
  water: 73,
  shallow: { topLeft: 10, top: 11, topRight: 12, left: 26, center: 27, right: 28, bottomLeft: 42, bottom: 43, bottomRight: 44 },
  sand: { topLeft: 1, top: 2, topRight: 3, left: 17, center: 18, right: 19, bottomLeft: 33, bottom: 34, bottomRight: 35 },
  grassIsland: [
    [6, 7, 8, 9],
    [22, 23, 24, 25],
    [38, 39, 40, 41],
    [54, 55, 56, 57],
  ],
} as const;

export interface Decoration {
  tile: number;
  /** Offset of the decoration centre from the island's top-left corner. */
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
}

export interface IslandLayout {
  style: 'sand' | 'grass';
  /** Top-left corner, in tiles. */
  tileX: number;
  tileY: number;
  /** Size in tiles. Grass islands are always 4x4 (their art is not tileable). */
  tilesWide: number;
  tilesHigh: number;
  decorations: readonly Decoration[];
}

export interface RockLayout {
  tile: number;
  x: number;
  y: number;
  /** Collider radius measured from the rock art's opaque bounds. */
  radius: number;
}

/**
 * Free-standing scenery in world coordinates: a tile (`tile`) or a frame of
 * the ships atlas (`frame`, e.g. a grey wreck). A `radius` makes it solid.
 */
export interface PropLayout {
  tile?: number;
  frame?: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  alpha?: number;
  radius?: number;
}

/** Everything drawn and collided with, without gameplay data. */
export interface SceneryLayout {
  islands: readonly IslandLayout[];
  rocks: readonly RockLayout[];
  props?: readonly PropLayout[];
}

export interface ArenaLayout extends SceneryLayout {
  playerSpawn: { x: number; y: number; heading: number };
}

export const ARENA_LAYOUT: ArenaLayout = {
  islands: [
    {
      style: 'grass',
      tileX: 3,
      tileY: 2,
      tilesWide: 4,
      tilesHigh: 4,
      decorations: [
        { tile: 71, x: 70, y: 196 },
        { tile: 72, x: 205, y: 70, scale: 0.8 },
      ],
    },
    {
      style: 'sand',
      tileX: 17,
      tileY: 1,
      tilesWide: 4,
      tilesHigh: 3,
      decorations: [
        { tile: 70, x: 64, y: 70, rotation: 0.4 },
        { tile: 66, x: 180, y: 120, scale: 0.9 },
        { tile: 87, x: 140, y: 52 },
      ],
    },
    {
      style: 'sand',
      tileX: 16,
      tileY: 9,
      tilesWide: 3,
      tilesHigh: 3,
      decorations: [
        { tile: 72, x: 132, y: 64 },
        { tile: 49, x: 62, y: 128, scale: 0.9 },
        { tile: 88, x: 120, y: 140 },
      ],
    },
    {
      style: 'sand',
      tileX: 5,
      tileY: 10,
      tilesWide: 5,
      tilesHigh: 3,
      decorations: [
        { tile: 71, x: 250, y: 96, scale: 0.9 },
        { tile: 50, x: 92, y: 92, scale: 0.85 },
        { tile: 87, x: 170, y: 140 },
      ],
    },
  ],
  rocks: [
    { tile: 50, x: 812, y: 205, radius: 24 },
    { tile: 51, x: 690, y: 585, radius: 19 },
    { tile: 67, x: 1430, y: 520, radius: 19 },
  ],
  playerSpawn: { x: 760, y: 420, heading: 0 },
};

/**
 * Sand and grass art fills its tiles almost edge to edge with a rounded
 * silhouette; the opaque outline is inset ~2px and its corners curve with a
 * ~56px radius, so the collider mirrors that instead of the full tile box.
 */
const ISLAND_EDGE_INSET = 2;
const ISLAND_CORNER_RADIUS = 56;

export function buildObstacles(layout: SceneryLayout): ObstacleShape[] {
  const obstacles: ObstacleShape[] = layout.islands.map((island) => ({
    kind: 'roundedRect',
    x: island.tileX * TILE_SIZE + ISLAND_EDGE_INSET,
    y: island.tileY * TILE_SIZE + ISLAND_EDGE_INSET,
    width: island.tilesWide * TILE_SIZE - ISLAND_EDGE_INSET * 2,
    height: island.tilesHigh * TILE_SIZE - ISLAND_EDGE_INSET * 2,
    cornerRadius: ISLAND_CORNER_RADIUS,
  }));
  for (const rock of layout.rocks) {
    obstacles.push({ kind: 'circle', x: rock.x, y: rock.y, radius: rock.radius });
  }
  for (const prop of layout.props ?? []) {
    if (prop.radius) obstacles.push({ kind: 'circle', x: prop.x, y: prop.y, radius: prop.radius });
  }
  return obstacles;
}
