import shipsSheetUrl from '../../../assets/spritesheet/ships_miscellaneous_sheet.png';
import shipsSheetXml from '../../../assets/spritesheet/ships_miscellaneous_sheet.xml?raw';
import tilesSheetUrl from '../../../assets/tilesheet/tiles_sheet_retina.png';
import enemyHealthFillGreenUrl from '../../../assets/png/retina/ui/hud/enemy_health_fill_green.png';
import enemyHealthFillRedUrl from '../../../assets/png/retina/ui/hud/enemy_health_fill_red.png';
import enemyHealthFrameUrl from '../../../assets/png/retina/ui/hud/enemy_health_frame.png';

/**
 * Every file the battle needs before it can start. Vite fingerprints these
 * URLs at build time, so only referenced assets end up in the bundle.
 *
 * The ships atlas is used at 1x: its "retina" variant in the asset pack has
 * identical dimensions. Tiles and HUD art ship real 2x variants.
 */
export const TEXTURE_ASSETS = {
  shipsSheet: shipsSheetUrl,
  tilesSheet: tilesSheetUrl,
  enemyHealthFrame: enemyHealthFrameUrl,
  enemyHealthFillRed: enemyHealthFillRedUrl,
  enemyHealthFillGreen: enemyHealthFillGreenUrl,
} as const;

export type TextureAssetKey = keyof typeof TEXTURE_ASSETS;

/** Resolution the file was authored at; 2x files map back to 1x logical units. */
export const TEXTURE_RESOLUTION: Readonly<Record<TextureAssetKey, number>> = {
  shipsSheet: 1,
  tilesSheet: 2,
  enemyHealthFrame: 2,
  enemyHealthFillRed: 2,
  enemyHealthFillGreen: 2,
};

export const SHIPS_SHEET_XML = shipsSheetXml;

const soundModules = import.meta.glob<string>('../../../assets/sounds/*.wav', {
  eager: true,
  query: '?url',
  import: 'default',
});

export type SoundName =
  | 'cannon_broadside'
  | 'cannon_fire_1'
  | 'cannon_fire_2'
  | 'cannon_fire_3'
  | 'cannonball_water_hit_1'
  | 'cannonball_water_hit_2'
  | 'game_complete'
  | 'game_over'
  | 'game_pause'
  | 'game_resume'
  | 'game_start'
  | 'health_low'
  | 'ocean_ambience_loop'
  | 'score_point'
  | 'ship_collision'
  | 'ship_explosion_1'
  | 'ship_explosion_2'
  | 'ship_sailing_loop'
  | 'ship_sinking'
  | 'ship_wood_hit_1'
  | 'ship_wood_hit_2'
  | 'time_warning'
  | 'ui_back'
  | 'ui_click'
  | 'ui_close'
  | 'ui_hover'
  | 'ui_open';

export const SOUND_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(soundModules).map(([path, url]) => [path.replace(/^.*\/(.+)\.wav$/, '$1'), url]),
);
