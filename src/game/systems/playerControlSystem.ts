import type { GameAction, InputState } from '../input/InputState';
import type { WeaponSlot } from '../simulation/entities';
import type { World } from '../simulation/World';

/**
 * A fire press made slightly before the cooldown ends still fires as soon as
 * it is ready, so rhythmic tapping never feels swallowed.
 */
const FIRE_BUFFER_SECONDS = 0.15;

const FIRE_ACTIONS: Readonly<Record<WeaponSlot, GameAction>> = {
  front: 'fireFront',
  left: 'fireLeft',
  right: 'fireRight',
};

export interface FireBuffer {
  front: number;
  left: number;
  right: number;
}

export function createFireBuffer(): FireBuffer {
  return { front: 0, left: 0, right: 0 };
}

export function applyPlayerInput(world: World, input: InputState, buffer: FireBuffer, dt: number): void {
  const player = world.player;
  const controls = player.controls;
  if (!player.alive) {
    controls.throttle = 0;
    controls.turn = 0;
    controls.fire.front = controls.fire.left = controls.fire.right = false;
    return;
  }

  controls.throttle = input.isHeld('forward') ? 1 : 0;
  controls.turn = (input.isHeld('turnRight') ? 1 : 0) - (input.isHeld('turnLeft') ? 1 : 0);

  for (const slot of ['front', 'left', 'right'] as const) {
    const action = FIRE_ACTIONS[slot];
    if (input.wasPressed(action)) buffer[slot] = FIRE_BUFFER_SECONDS;
    else buffer[slot] = Math.max(0, buffer[slot] - dt);
    const wantsFire = input.isHeld(action) || buffer[slot] > 0;
    const ready = player.cooldowns[slot] <= dt;
    controls.fire[slot] = wantsFire;
    if (wantsFire && ready) buffer[slot] = 0;
  }
}
