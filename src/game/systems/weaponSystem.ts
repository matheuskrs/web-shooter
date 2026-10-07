import type { WeaponConfig } from '../config/gameConfig';
import type { Ship, WeaponSlot } from '../simulation/entities';
import type { World } from '../simulation/World';

const SLOTS: readonly WeaponSlot[] = ['front', 'left', 'right'];

export function updateWeapons(world: World, dt: number): void {
  if (world.phase !== 'running') return;
  for (const ship of world.ships) {
    if (!ship.alive) continue;
    for (const slot of SLOTS) {
      if (ship.cooldowns[slot] > 0) ship.cooldowns[slot] = Math.max(0, ship.cooldowns[slot] - dt);
      const weapon = ship.weapons[slot];
      if (!weapon || !ship.controls.fire[slot] || ship.cooldowns[slot] > 0) continue;
      fire(world, ship, slot, weapon);
      ship.cooldowns[slot] = weapon.cooldownSeconds;
    }
  }
}

/** Direction a slot fires in, relative to the bow. Left is port (counter-clockwise). */
function slotAngle(slot: WeaponSlot): number {
  return slot === 'front' ? 0 : slot === 'left' ? -Math.PI / 2 : Math.PI / 2;
}

function fire(world: World, ship: Ship, slot: WeaponSlot, weapon: WeaponConfig): void {
  const angle = ship.heading + slotAngle(slot);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const keelX = Math.cos(ship.heading);
  const keelY = Math.sin(ship.heading);

  // Parallel balls are spread along the keel; the centre ball sits amidships.
  const centreIndex = (weapon.projectileCount - 1) / 2;
  for (let i = 0; i < weapon.projectileCount; i++) {
    const alongKeel = (i - centreIndex) * weapon.spacing;
    const x = ship.x + dirX * weapon.muzzleOffset + keelX * alongKeel;
    const y = ship.y + dirY * weapon.muzzleOffset + keelY * alongKeel;
    world.projectiles.push({
      id: world.allocateId(),
      team: ship.team,
      ownerId: ship.id,
      slot,
      damage: weapon.damage,
      radius: weapon.projectileRadius,
      x,
      y,
      prevX: x,
      prevY: y,
      vx: dirX * weapon.projectileSpeed,
      vy: dirY * weapon.projectileSpeed,
      remainingDistance: weapon.range,
      alive: true,
    });
  }
  world.emit({
    type: 'shotFired',
    shipId: ship.id,
    team: ship.team,
    slot,
    x: ship.x + dirX * weapon.muzzleOffset,
    y: ship.y + dirY * weapon.muzzleOffset,
    angle,
    keelAngle: ship.heading,
    count: weapon.projectileCount,
    spacing: weapon.spacing,
  });
}
