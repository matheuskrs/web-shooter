import { circleVsObstacle, createPenetration } from '../collision/geometry';
import type { Ship } from '../simulation/entities';
import type { World } from '../simulation/World';
import { damageShip, destroyShip } from './damage';
import { hullCircleX, hullCircleY } from './hull';

/**
 * Two passes let a ship wedged between an island and the arena edge settle
 * without visible jitter; one pass can leave it overlapping the first shape
 * after being pushed out of the second.
 */
const RESOLVE_PASSES = 2;
/** How much a head-on scrape bleeds speed per second, so ships slide instead of sticking. */
const SCRAPE_FRICTION = 3;

const penetration = createPenetration();

export function resolveShipCollisions(world: World, dt: number): void {
  // Ship contacts first: separating two ships may push one into an island,
  // which the static passes below then correct before anything is rendered.
  resolveShipContacts(world);
  for (let pass = 0; pass < RESOLVE_PASSES; pass++) {
    for (const ship of world.ships) {
      if (!ship.alive) continue;
      resolveAgainstObstacles(world, ship, dt / RESOLVE_PASSES);
      keepInsideArena(world, ship);
    }
  }
}

function resolveAgainstObstacles(world: World, ship: Ship, dt: number): void {
  const { circleOffsets, radius } = ship.config.hull;
  for (let i = 0; i < circleOffsets.length; i++) {
    for (const obstacle of world.obstacles) {
      const cx = hullCircleX(ship, i);
      const cy = hullCircleY(ship, i);
      if (!circleVsObstacle(cx, cy, radius, obstacle, penetration)) continue;
      ship.x += penetration.normalX * penetration.depth;
      ship.y += penetration.normalY * penetration.depth;

      const headOn = -(Math.cos(ship.heading) * penetration.normalX + Math.sin(ship.heading) * penetration.normalY);
      if (headOn > 0) ship.speed -= ship.speed * Math.min(1, headOn * SCRAPE_FRICTION * dt);
    }
  }
}

function keepInsideArena(world: World, ship: Ship): void {
  const { width, height } = world.config.arena;
  const { circleOffsets, radius } = ship.config.hull;
  for (let i = 0; i < circleOffsets.length; i++) {
    const cx = hullCircleX(ship, i);
    const cy = hullCircleY(ship, i);
    if (cx < radius) ship.x += radius - cx;
    else if (cx > width - radius) ship.x -= cx - (width - radius);
    if (cy < radius) ship.y += radius - cy;
    else if (cy > height - radius) ship.y -= cy - (height - radius);
  }
}

function resolveShipContacts(world: World): void {
  const ships = world.ships;
  for (let a = 0; a < ships.length; a++) {
    const first = ships[a] as Ship;
    if (!first.alive) continue;
    for (let b = a + 1; b < ships.length; b++) {
      const second = ships[b] as Ship;
      if (!second.alive || !first.alive) continue;
      const depth = deepestOverlap(first, second);
      if (depth === null) continue;

      // A chaser explodes against any hull of the opposing team. In a match the
      // only opposing hull is the player's; the menu's attract world reuses this.
      const chaser = first.kind === 'chaser' ? first : second.kind === 'chaser' ? second : null;
      const other = chaser === first ? second : first;
      if (chaser && other.team !== chaser.team) {
        ram(world, chaser, other);
        continue;
      }
      separate(first, second, depth);
    }
  }
}

function ram(world: World, chaser: Ship, victim: Ship): void {
  world.emit({ type: 'chaserRammed', x: chaser.x, y: chaser.y });
  // The chaser explodes on impact: no point is awarded for a self-destruction.
  destroyShip(world, chaser, { cause: 'ram', team: chaser.team });
  damageShip(world, victim, world.config.chaser.ramDamage, { cause: 'ram', team: chaser.team });
}

interface Overlap {
  normalX: number;
  normalY: number;
  depth: number;
}

const overlap: Overlap = { normalX: 0, normalY: 0, depth: 0 };

/** Deepest overlap between any pair of hull circles, as a push from `second` towards `first`. */
function deepestOverlap(first: Ship, second: Ship): Overlap | null {
  const firstHull = first.config.hull;
  const secondHull = second.config.hull;
  const reach = firstHull.radius + secondHull.radius;
  let found = false;
  overlap.depth = 0;
  for (let i = 0; i < firstHull.circleOffsets.length; i++) {
    const ax = hullCircleX(first, i);
    const ay = hullCircleY(first, i);
    for (let j = 0; j < secondHull.circleOffsets.length; j++) {
      const dx = ax - hullCircleX(second, j);
      const dy = ay - hullCircleY(second, j);
      const distSq = dx * dx + dy * dy;
      if (distSq >= reach * reach) continue;
      const dist = Math.sqrt(distSq);
      const depth = reach - dist;
      if (depth <= overlap.depth) continue;
      found = true;
      overlap.depth = depth;
      overlap.normalX = dist > 1e-9 ? dx / dist : 1;
      overlap.normalY = dist > 1e-9 ? dy / dist : 0;
    }
  }
  return found ? overlap : null;
}

function separate(first: Ship, second: Ship, contact: Overlap): void {
  const half = contact.depth / 2;
  first.x += contact.normalX * half;
  first.y += contact.normalY * half;
  second.x -= contact.normalX * half;
  second.y -= contact.normalY * half;
}
