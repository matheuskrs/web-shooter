import uiSheet from '../../../assets/spritesheet/ui_sheet.json';

/**
 * Layout metadata authored in the UI atlas (`ui.layout`), in logical 1x
 * units relative to the sprite's top-left corner. Reading it from the atlas
 * keeps fill clipping and button label areas aligned with the art.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const frames = uiSheet.frames;

export const ENEMY_HEALTH_BAR = {
  width: frames.enemy_health_frame.sourceSize.w,
  height: frames.enemy_health_frame.sourceSize.h,
  fillRect: frames.enemy_health_fill_red.ui.layout.fill_rect as Rect,
} as const;

export const PLAYER_HEALTH_BAR = {
  width: frames.health_frame.sourceSize.w,
  height: frames.health_frame.sourceSize.h,
  fillRect: frames.health_fill_green.ui.layout.fill_rect as Rect,
} as const;

export const MENU_PANEL = {
  width: frames.panel_menu.sourceSize.w,
  height: frames.panel_menu.sourceSize.h,
  borders: frames.panel_menu.borders,
  contentRect: frames.panel_menu.ui.layout.content_rect as Rect,
} as const;

export const MENU_BUTTON = {
  width: frames.button_primary_normal.sourceSize.w,
  height: frames.button_primary_normal.sourceSize.h,
  outerRect: frames.button_primary_normal.ui.layout.outer_rect as Rect,
  labelRect: frames.button_primary_normal.ui.layout.label_rect as Rect,
} as const;

export const ROUND_BUTTON = {
  size: frames.button_round_normal.sourceSize.w,
  outerRect: frames.button_round_normal.ui.layout.outer_rect as Rect,
  iconRenderSize: frames.button_round_normal.ui.layout.icon_render_size,
} as const;

export const COUNTER_PANEL = {
  width: frames.counter_panel.sourceSize.w,
  height: frames.counter_panel.sourceSize.h,
} as const;
