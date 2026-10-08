import { ARENA_LAYOUT, TILE_SIZE, type IslandLayout, type PropLayout, type RockLayout, type SceneryLayout } from '../arena/arenaLayout';

/**
 * The menu world: one larger sea that every screen looks at from a
 * different spot. It contains the real match arena's islands at
 * `ARENA_ORIGIN`, so the PLAY transition can swap the attract world for the
 * real (bounded) match world mid-flight without the scenery changing.
 *
 * Everything sits on the 64px tile grid so the two worlds' water tiles line
 * up exactly at the swap.
 */
export const ATTRACT_BOUNDS = { width: 88 * TILE_SIZE, height: 60 * TILE_SIZE } as const;

export const ARENA_ORIGIN = { x: 32 * TILE_SIZE, y: 22 * TILE_SIZE } as const;

export type WorldLocation = 'menu' | 'options' | 'log' | 'arena';

export interface CameraAnchor {
  x: number;
  y: number;
  zoom: number;
}

export const LOCATIONS: Readonly<Record<WorldLocation, CameraAnchor>> = {
  /** A fortified harbour where the fleets usually clash. */
  menu: { x: 3950, y: 2950, zoom: 1.1 },
  /** A quiet lagoon away from the fighting. */
  options: { x: 1150, y: 2950, zoom: 1.15 },
  /** Docks and anchored ships: the Captain's Log (ranking and match history share it). */
  log: { x: 4550, y: 1000, zoom: 1.1 },
  /** The match arena, framed exactly as during a battle. */
  arena: { x: ARENA_ORIGIN.x + 800, y: ARENA_ORIGIN.y + 450, zoom: 1 },
};

const sand = (tileX: number, tileY: number, tilesWide: number, tilesHigh: number, decorations: IslandLayout['decorations'] = []): IslandLayout => ({
  style: 'sand',
  tileX,
  tileY,
  tilesWide,
  tilesHigh,
  decorations,
});

const grass = (tileX: number, tileY: number, decorations: IslandLayout['decorations'] = []): IslandLayout => ({
  style: 'grass',
  tileX,
  tileY,
  tilesWide: 4,
  tilesHigh: 4,
  decorations,
});

/** A horizontal fort wall: towers at both ends, cannons either side of a wooden gate. */
const FORT_WALL = [30, 16, 47, 76, 48, 16, 62].map((tile, index) => ({ tile, x: 64 + 64 * index, y: 96 }));

/** Broken walls and a lone tower: the ruin at the wreck field. */
const RUINS = [
  { tile: 13, x: 48, y: 64 },
  { tile: 90, x: 112, y: 64 },
  { tile: 92, x: 176, y: 64 },
  { tile: 91, x: 48, y: 128 },
];

const arenaIslands: IslandLayout[] = ARENA_LAYOUT.islands.map((island) => ({
  ...island,
  tileX: island.tileX + ARENA_ORIGIN.x / TILE_SIZE,
  tileY: island.tileY + ARENA_ORIGIN.y / TILE_SIZE,
}));

const arenaRocks: RockLayout[] = ARENA_LAYOUT.rocks.map((rock) => ({ ...rock, x: rock.x + ARENA_ORIGIN.x, y: rock.y + ARENA_ORIGIN.y }));

const islands: IslandLayout[] = [
  ...arenaIslands,
  // Harbour (menu)
  sand(51, 41, 8, 4, [...FORT_WALL, { tile: 71, x: 420, y: 200 }, { tile: 87, x: 120, y: 200 }]),
  grass(65, 44, [{ tile: 70, x: 80, y: 180 }, { tile: 72, x: 190, y: 90 }]),
  sand(60, 50, 3, 3, [{ tile: 49, x: 100, y: 96 }]),
  // Lagoon (options)
  sand(12, 42, 3, 3, [{ tile: 72, x: 96, y: 90 }]),
  sand(21, 44, 4, 3, [{ tile: 70, x: 70, y: 100 }, { tile: 88, x: 180, y: 120 }]),
  grass(14, 48, [{ tile: 71, x: 190, y: 190 }]),
  // Docks (ranking)
  sand(66, 11, 6, 3, [{ tile: 71, x: 60, y: 90 }, { tile: 66, x: 320, y: 70, scale: 0.8 }]),
  grass(75, 16, [{ tile: 72, x: 70, y: 70 }]),
  // Ruins (history)
  sand(14, 10, 4, 3, [...RUINS, { tile: 67, x: 200, y: 140 }]),
  // Open-sea islands passed during travel
  grass(26, 3),
  sand(43, 5, 3, 3, [{ tile: 71, x: 96, y: 96 }]),
  sand(7, 27, 4, 3, [{ tile: 49, x: 90, y: 100 }]),
  sand(80, 27, 3, 3, [{ tile: 72, x: 96, y: 96 }]),
  sand(59, 21, 3, 3),
  sand(72, 35, 4, 3, [{ tile: 70, x: 128, y: 96 }]),
  sand(28, 50, 5, 3, [{ tile: 71, x: 200, y: 96 }]),
  grass(46, 52),
];

const rocks: RockLayout[] = [
  ...arenaRocks,
  { tile: 50, x: 4300, y: 2620, radius: 24 },
  { tile: 51, x: 3640, y: 3180, radius: 19 },
  { tile: 66, x: 1290, y: 2640, radius: 24 },
  { tile: 65, x: 690, y: 3200, radius: 17 },
  { tile: 67, x: 1560, y: 650, radius: 19 },
  { tile: 65, x: 780, y: 1180, radius: 17 },
  { tile: 51, x: 2400, y: 700, radius: 19 },
  { tile: 50, x: 5100, y: 2100, radius: 24 },
];

const props: PropLayout[] = [
  // Docks: piers reaching out from the harbour island, boats tied up beside them.
  { tile: 60, x: 4320, y: 928 },
  { tile: 60, x: 4320, y: 992, radius: 30 },
  { tile: 60, x: 4512, y: 928 },
  { tile: 60, x: 4512, y: 992, radius: 30 },
  { frame: 'dinghy_large_1', x: 4372, y: 960, rotation: 0.1 },
  { frame: 'dinghy_large_3', x: 4462, y: 975, rotation: -0.15 },
  { frame: 'dinghy_small_2', x: 4590, y: 960, rotation: 0.25 },
  { frame: 'ship_1', x: 4700, y: 760, rotation: 1.9, radius: 34 },
  { frame: 'ship_5', x: 4140, y: 1080, rotation: -1.2, radius: 34 },
  // Wreck field: grey hulls and debris of earlier battles.
  { frame: 'ship_20', x: 1460, y: 1060, rotation: 0.8, radius: 32 },
  { frame: 'ship_22', x: 880, y: 1230, rotation: -1.2, radius: 32 },
  { frame: 'ship_24', x: 1700, y: 760, rotation: 2.3, radius: 32 },
  { frame: 'hull_large_4', x: 1240, y: 1330, rotation: 0.35, radius: 28 },
  { frame: 'hull_small_4', x: 620, y: 860, rotation: -0.6, radius: 24 },
  { frame: 'wood_2', x: 1360, y: 1180, rotation: 0.4 },
  { frame: 'wood_4', x: 1010, y: 1100, rotation: 2.1 },
  { frame: 'wood_1', x: 1580, y: 900, rotation: -0.9 },
  { frame: 'wood_3', x: 960, y: 1360, rotation: 1.2 },
  { frame: 'cannon_loose', x: 1130, y: 1250, rotation: 0.6 },
  { frame: 'crew_2', x: 1520, y: 1180, rotation: 1.4 },
  // A dinghy resting in the lagoon.
  { frame: 'dinghy_small_1', x: 1040, y: 3040, rotation: -0.4 },
];

export const ATTRACT_LAYOUT: SceneryLayout = { islands, rocks, props };
