# Architecture

Pirate Battle is split along one rule: **the game simulation owns everything that changes every frame; React owns the application around it.** React never stores ship positions and never re-renders per frame. The simulation never knows React, the DOM or the network exist.

```
main.tsx (composition root: MSW worker, QueryClient, AudioManager, AssetLoader)
 └─ App (hash routes: menu · options · battle · result)
     ├─ MainMenu ── CaptainsLog ── TanStack Query ── Axios ── /api/* ── MSW handlers ── mock DB (localStorage)
     ├─ Options ── preferences (localStorage) · network simulation panel
     ├─ Result ── last result + pending uploads (localStorage) · registration mutation
     └─ BattleScreen
         ├─ HUD / pause dialog / touch controls / live region   ← GameUiStore (discrete values only)
         └─ GameCanvas ──────── creates/disposes ──► GameSession (one per match)
                                                       ├─ World + systems (pure TS, fixed step)
                                                       ├─ InputState ◄─ KeyboardInput / TouchControls
                                                       ├─ GameRenderer (Pixi views, effects)
                                                       └─ BattleAudio (Web Audio voices)
```

## React and PixiJS

`src/screens/battle/GameCanvas.tsx` is the only component that touches Pixi. Its effect creates a `GameSession`, gives it a DOM node, and disposes it on unmount. The dependencies are the match's identity (config, seed, input, store), so a new match means a new session. `BattleScreen` is keyed by `matchId`, so **Play Again** and **Restart** remount everything from scratch.

The session talks back through two narrow channels:

- **`GameUiStore`** (`src/game/bridge`) is an external store read through `useSyncExternalStore`. The session writes health, score, the displayed whole second, the phase and the pause reason, and listeners are notified **only when a value changes**. During play React renders a few times per second (score, health, each second), never per frame.
- **`onEnded(outcome)`** fires once with the score, effective duration and end reason.

Input travels the other way through `InputState`. Touch buttons call `input.press/release` directly, which causes no React state updates during play beyond the pressed-button visual.

## World host, camera and the living menu

`src/game/world/WorldHost.ts` owns the page's **single** Pixi `Application`, created once and kept for the page's lifetime. Its single ticker callback drives the camera and whatever is on screen. React mounts it through `WorldCanvas`, which only attaches and detaches the canvas, so Strict Mode's double mount is harmless.

- **One continuous sea.** The menu world (`attractLayout.ts`) is a larger sea that contains the match arena's islands at `ARENA_ORIGIN`. Each screen is a viewpoint in it (`LOCATIONS`): harbour (menu), lagoon (options), docks (Ranking and Match History share this one, so switching tabs does not move the camera) and the arena. All scenery sits on the 64 px tile grid, so the menu world's water and a match's water line up exactly.
- **Attract mode** (`AttractScene.ts`, `attractAiSystem.ts`): two small fleets fight with the *real* movement, collision, weapon, projectile and damage systems and the real renderer. The world has no player (`World.player === null`), no clock, no spawner and no score that anyone reads, so it can never create a match, a record or a pending upload. Ships that drift off screen are recycled near the camera's focus.
- **CameraDirector** (`CameraDirector.ts`) is a pose (`x`, `y`, `zoom`) plus a queue of travel legs. A leg uses a smootherstep curve (velocity rises and falls like a bell) and dips the zoom with `sin(pi * t)`: zoom out, travel, zoom in. At rest the camera drifts slowly towards the top-left. The camera reports its screen velocity; above 300 px/s a `MotionBlurFilter` (pixi-filters) is attached to the screen-space viewport along that direction, and it is detached otherwise, so idle frames pay nothing.
- **Screens are placed in the world.** `AnchoredScreen` registers its DOM layer with the host, which writes `translate(...) scale(...)` from the camera every frame (a direct style write, so no React render). During travel the screen being left shrinks away while the destination grows into view, both moving with the sea. Panels ignore the idle drift (they float above the water), and the drift is faded out over the first leg so they never jump.
- **PLAY** flies to the player's spawn, swaps the attract world for the new match world at the leg's midpoint (under the strongest blur), closes in on the ship, and settles into the 1600 x 900 arena framing. Only then does `GameSession.begin()` attach input and start the clock. The arena rules, bounds and collisions are untouched; the larger sea is purely an illusion around them.
- **Reduced motion and tests:** with `prefers-reduced-motion` the camera cuts instead of travelling and there is no blur or drift. With `?clock=manual` the menu world is frozen as well, which keeps screenshots deterministic.

## GameSession lifecycle

`src/game/core/GameSession.ts` owns one match: its `World`, the fixed-step loop, keyboard/blur/visibility listeners, the renderer (drawn into a container inside the host's world) and the match's audio loops.

`created -> begin() -> running -> halt() -> halted -> dispose()`

- Before `begin()` the arena is drawn but frozen, so the camera can fly in over it.
- `halt()` runs the moment the player leaves the battle: input, pause triggers, audio and the simulation stop immediately, while the picture stays until the camera has flown away.
- `dispose()` is idempotent. It destroys every sprite and the session's own generated textures, never the shared atlas textures.

`src/game/diagnostics` counts sessions created and disposed and the listeners currently attached. The E2E suite asserts `live === 0` after repeated start -> leave cycles, and that exactly one canvas exists.

## Fixed timestep

`src/game/core/FixedStepLoop.ts` accumulates real elapsed time from the Pixi ticker and spends it in **1/60 s steps**, at most 5 per frame; any further backlog is dropped. Movement, cooldowns, spawns and the match clock therefore behave the same at 30, 60 or 144 FPS. The remainder of the accumulator becomes `alpha`, and views interpolate between each entity's previous and current pose, so motion stays smooth on high-refresh displays.

In tests, `?clock=manual` (non-production builds only) disables the ticker feed, and `advanceManually(seconds)` runs exactly `round(seconds × 60)` steps followed by one render.

## World, entities and system order

`World` (`src/game/simulation/World.ts`) is plain mutable data: arrays of `Ship` and `Projectile` objects with stable numeric ids, the score, the clock, the spawner state and an event list. There is no ECS: two entity kinds do not need one. Systems are plain functions, called in a fixed order by `stepSimulation`:

1. **Intents:** `applyPlayerInput` (input → throttle/turn/fire, with a 0.15 s fire buffer so a tap just before the cooldown ends still fires) and `updateEnemyAi`.
2. **Movement:** speed approaches `throttle × maxSpeed` with separate acceleration and deceleration rates; velocity always points along the heading; the turn rate scales from 75% when stopped to 100% at full speed.
3. **Contacts:** Chaser rams, ship separation, then two push-out passes against islands and arena edges.
4. **Weapons:** cooldowns tick; firing spawns projectiles at the muzzles.
5. **Projectiles:** move, hit at most one ship *or* obstacle, expire by range, or leave the arena.
6. **Spawner**, then the **match clock**.
7. **Cleanup:** dead entities are compacted out of the arrays.

Every system checks `world.phase`, so a death earlier in a step stops shooting, damage, spawns and scoring for the rest of that step.

## Movement feel

The handling is arcade, not simulation. Full speed arrives in about 0.25 s and coasting stops in about 0.55 s. Turning is applied immediately with no angular inertia. Velocity never drifts off the heading, so steering is predictable. The constants live in `BASE_GAME_CONFIG.player.movement` and were tuned against the 1600 × 900 arena: the full-speed turn radius is about 74 px, roughly one ship length.

## Enemy AI

`src/game/systems/enemyAiSystem.ts`:

- **Chaser:** steers proportionally towards a point slightly ahead of the player (a lead of up to 0.3 s) at full sail, easing the throttle only when facing away, so it can turn tightly.
- **Shooter:** closes in beyond 90% of its 500 px attack range, holds position and pivots to aim inside it, and sails away when closer than 220 px. It fires only within range, inside a 0.14 rad aim tolerance, when the cooldown allows, and with a clear line of sight (sampled points against the island shapes). This keeps it from emptying shots into islands and from behaving like a Chaser with a gun.
- **Avoidance (both):** two probes ahead plus left and right whiskers test for islands and arena edges. When the bow is about to hit, the ship commits to the freer side for 0.7 s, so it does not flip-flop. A ship pushing its throttle but barely moving for 0.8 s is "stuck" and flips its avoidance side. In a 20-seed headless probe, enemies spent about 0.2% of their time stuck.

## Collision model

`src/game/collision/geometry.ts` contains pure functions, unit-tested.

- **Ships:** three circles along the keel (`hull.circleOffsets`, `hull.radius`). These are close to the hull's real outline, cheap, and stable when rotating. Projectile hits add `hitRadiusBonus` so balls grazing the sails count.
- **Islands:** a rounded rectangle per island. The island art fills its tiles to within about 2 px and its corners curve with a radius of about 56 px, measured from the tile alpha. The collider therefore follows the visible sand instead of the tile box, and ships can round the corners. Rocks are circles sized from their opaque bounds.
- **Resolution:** penetration depth along the outward normal is applied as an immediate position correction. There are no impulses, so nothing bounces or jitters. Head-on scrapes bleed speed, while glancing contacts keep their tangential motion, so the ship slides along the shore instead of sticking.
- **No sweeping:** the fastest ball moves 12 px per step, and the smallest reach (hull + bonus + ball) is about 27 px, so tunnelling cannot happen at these speeds.

## Projectiles, damage and death

A projectile is retired (`alive = false`) in the same call that applies its damage, so it cannot hit twice or hit a second ship. `damageShip` (`src/game/systems/damage.ts`) is the only place where health changes, and a ship that reaches 0 health dies **inside that call**. Later systems in the same step therefore already ignore it: it cannot shoot, collide, be hit or steer. Points are awarded only for `cause: 'cannon'` from the player. A Chaser's ram destroys it with `cause: 'ram'` and awards nothing.

## Rendering

`GameRenderer` creates a view the first time it sees an entity id and destroys it when the id leaves the world. The simulation never calls the renderer. Discrete moments (shots, hits, splashes, spawns, deaths, end of match) reach rendering and audio as **events** that the session drains once per frame. Effects, shake and audio are driven by those events and use their own random stream, so they can never change gameplay.

- **Arena:** two drifting `TilingSprite`s of the official water tile, plus islands built from the tile set: a 3×3 nine-slice sand island stretchable to any size, the 4×4 grass island, and the translucent shallow-water ring. Each island is baked once with `cacheAsTexture` at the tiles' native 2× resolution, which removes the hairline seams that linear filtering draws between adjacent tiles at fractional scales. The sea outside the arena is darkened so the boundary reads clearly.
- **Ships:** the official sprites, which come in four damage stages (intact, damaged, critical, grey wreck). The sprite changes at 2/3 and 1/3 health; flames from the effects art appear on deck and stay upright on screen. Hits flash the hull and kick it back; firing recoils it away from the firing side. Kinds are told apart by the art itself: player red, Shooter yellow, Chaser black and smaller. The luminance difference keeps them distinguishable for red/green colour blindness.
- **Health bars:** the official enemy health frame and fill art, in a non-rotating overlay layer. The fill is clipped from the left exactly as the atlas metadata prescribes (`fill_rect`, `clip_axis: x`), by giving the sprite a narrower frame of the same texture, so the rounded end caps are never squashed.
- **Effects:** a single data-driven particle list in `EffectsLayer`, with one recipe per moment: a muzzle flash and smoke per cannon, splinters, a ripple and glow splash, a layered explosion with debris and crew overboard, and spawn ripples. Destroyed ships become grey wrecks that fade and sink over 1.8 s.
- **Resize:** the camera frames 1600 × 900 world units at zoom 1 (`min(width / 1600, height / 900)`), centred on its pose; in battle the pose is the arena centre, so the arena fits the screen exactly. The renderer resolution is `min(devicePixelRatio, 2)` with `autoDensity`, so simulation coordinates never depend on CSS pixels or DPR. Touch input uses buttons, so no pointer-to-world mapping is required.

## Assets

`src/game/assets/AssetLoader.ts` loads the battle's textures once per page through `Pixi.Assets`: the ships atlas, the 2× tilesheet and the 2× HUD bar art. Sounds go through Web Audio. Its state (`idle | loading | ready | error`, progress) is subscribable, so React shows a progress bar and a Retry button. Pixi evicts failed URLs from its promise cache, so Retry really refetches. Sounds are best effort: a missing file stays silent instead of blocking the battle.

- The ships atlas is a Starling/Sparrow XML file, which Pixi does not read. `starlingAtlas.ts` converts it to Pixi's spritesheet data at load time, so the whole fleet shares one texture. The pack's "retina" ships sheet has the same pixel size as the 1× sheet, so the 1× sheet is used.
- Tiles are frames of the 2× tilesheet loaded with `resolution: 2`, so every frame is addressed in 1× logical units.
- The React UI uses the individual PNGs through CSS `image-set()` (1× and 2×). The menu panel is nine-sliced with CSS `border-image`, using the atlas `borders` (40/32). Button and round-button proportions and label areas follow the atlas `layout` metadata. Buttons are real `<button>` elements with the normal, hover, pressed and disabled art.
- Textures are shared: sessions destroy their sprites and their own generated textures, never the loader's textures.

## Audio

`AudioManager` creates the `AudioContext` on the first user gesture, which avoids autoplay warnings. It caps simultaneous voices per sound, so a broadside volley stays punchy instead of turning into noise. `BattleAudio` maps events to sounds with slight pitch variation, owns the ocean and sailing loops (sailing volume follows speed), and stops them on dispose.

## Pause

There are three triggers: Esc/P or the HUD button, `window` blur, and `visibilitychange` to hidden. A portrait phone also pauses. Pausing clears every held input, resets the loop accumulator and **stops the Pixi ticker**. With nothing advancing, the timer, cooldowns, spawns and effects are all frozen. Resuming requires an explicit action (the Resume button or Esc), and it clears input again, so keys held during the pause do nothing until pressed again. The pause menu is a native modal `<dialog>`, which provides focus trapping, inert background, focus restore and Escape handling.

## Persistence (localStorage)

`createStoredValue` (`src/storage/storedValue.ts`) wraps each key with validation. Corrupt or outdated data falls back to defaults, and unavailable storage degrades to memory.

| Key | Content |
| --- | --- |
| `pirate-battle:preferences:v1` | session time, spawn time, captain name, sound |
| `pirate-battle:player-id:v1` | anonymous player id (generated once) |
| `pirate-battle:last-result:v1` | last finished match + whether the server confirmed it |
| `pirate-battle:pending-matches:v1` | finished matches not yet confirmed |
| `pirate-battle:mock-db:v1` | the mock server's confirmed records and data version |
| `pirate-battle:mock-scenario:v1` | selected network scenario |

A battle is never persisted. Reloading on `#/battle` lands on the menu, and an abandoned match is never registered.

## Ranking and history: Axios, TanStack Query and MSW

- **Contracts** (`src/api/contracts.ts`) are shared by the client and the handlers. A record carries the match id, player id and name, date, score, effective duration, end reason, the config used, and its `configKey`.
- **Axios** (`src/api/client.ts`) is one instance with `/api` and a timeout. Every failure becomes an `ApiError` with a kind (`timeout | network | client | server | cancelled`) and a `retryable` flag (timeouts, network errors and 5xx), which drives the retry policy.
- **Queries** (`src/api/queries.ts`) are keyed by `[ranking, configKey, page]` and `[history, playerId, page]`. They use `staleTime: 0` (cached rows render instantly while every mount or focus revalidates in the background), `keepPreviousData` for paging, and up to 2 retries for retryable errors only. The UI shows loading, empty, error-with-retry, "Updating…" during background refetches, and dimmed rows while a new page loads.
- **Registration** is defined once with `queryClient.setMutationDefaults(['register-match'])` (`src/api/queryClient.ts`): `mutationFn`, retries, and `onSuccess`/`onError`. Because the callbacks live on the client rather than in a screen, they still run if the player leaves the result screen mid-request. On success the client removes the pending entry, marks the last result as confirmed, and invalidates both ranking and history, so both tabs refresh. On failure it records the attempt and error on the pending entry.
- **MSW** (`src/mocks`) runs in every build because the deployed demo has no backend. If the service worker cannot start, the app still works and only the log shows errors. The handlers are a thin adapter over pure functions in `mockServer.ts` (unit-tested). Fixtures are generated from a seed derived from the config key and a fixed date, so they are identical on every run.

### Idempotency

The client generates the `matchId` (UUID) when the match starts. It is the idempotency key, sent in the body and the `Idempotency-Key` header. The server stores the first submission and answers `201 { created: true }`. Any later submission with the same id returns the **stored record** with `200 { created: false }`, or `409` if the payload differs. A retry can therefore never create a second history row or ranking entry. In the `register-timeout-after-commit` scenario the server commits and then never answers the first attempt; the client times out, retries with the same id and receives the existing record.

### Pending matches and recovery

When a match ends, the submission is written to `last-result` and `pending-matches` **before** the request starts, so closing the tab at that moment loses nothing. On app start, every pending match is submitted once. The menu and the result screen show pending uploads with **Retry now**, and Options lists them. Pending uploads never block starting a new battle. Parallel duplicate clicks are ignored while a registration for the same id is in flight.

### Stale responses

There are two layers:

1. **TanStack Query:** each page has its own key, and a superseded fetch is cancelled through its `AbortSignal`, which reaches Axios.
2. **`keepNewest`:** every list response carries the server's monotonic `dataVersion`. If an older snapshot still lands for a key that already holds a newer one, the newer data is kept.

The `out-of-order` scenario and its E2E test exercise this.

### Ranking rule

Only matches with the same `configKey` (ruleset version, session time, spawn time) are compared. The order is score descending, then the earlier `playedAt` (whoever reached the score first), then `matchId` ascending, so equal scores never reshuffle between requests.

## Accessibility

The menus are semantic and keyboard navigable, with visible focus rings, ARIA tabs with arrow-key navigation, labelled fields, and errors linked through `aria-describedby` and announced with `role="alert"`. Score, time and health are labelled groups in the HUD. A polite live region announces only meaningful moments: score changes, low health, the 60/30/10-second marks, pause and the end of the match. Gameplay keys are captured only while a battle is running and unpaused, and never while focus is in a form field. `prefers-reduced-motion` shortens CSS animations.

## Testing strategy

- **Unit (Vitest):** pure math and rules run headless, since the simulation imports nothing from Pixi.
- **E2E (Playwright):** an optimized `--mode e2e` build with the same shape as production, plus a small test API and a 3 s request timeout. Tests use a fixed seed and the manual clock. **Inputs are real**: Playwright keyboard events, mouse/touch taps, and multi-touch through CDP. The test API can observe state, advance the clock, place the player or an enemy, and pause the spawner, but it cannot move, fire or damage anything. Every test runs in a fresh browser context, so storage and the service worker start clean.
- **Visual regression:** menu, stable arena and result screen, with `animations: 'disabled'`, UTC timezone and fixed seed. The baselines are platform-specific, as Playwright stores them.

## Balancing decisions

The values live in `BASE_GAME_CONFIG`; `RULESET_VERSION` is bumped whenever they change, so rankings never mix rulesets.

- **Weapons:** the bow cannon is light and fast (20 damage, 0.32 s cooldown, 720 px/s, 620 px range). The broadside is heavy (3 × 25 damage, 1.4 s cooldown per side, shorter 420 px range).
- **Enemies:** a Chaser has 40 HP (two bow hits), sails at 185 vs the player's 230 and rams for 20. A Shooter has 80 HP (so one broadside does not delete it), holds 220–500 px and fires 8 damage every 2.4 s.
- **Spawns:** a shuffle bag of 3 Chasers : 2 Shooters guarantees both kinds within the first five spawns. At most 7 enemies are alive at once, and spawns sit at least 520 px from the player (beyond Shooter range) and clear of islands.
- **Tuning method:** a headless probe ran 20 seeded matches with a crude scripted helmsman. With the first values (10 alive, Shooter 10 damage / 1.9 s, ram 25) it sank after 52 s on average. With the current values it survived about 68 s and sank about 18 enemies. A human who shoots Chasers before they arrive does better; rams caused about 60% of the bot's damage.

## Known limitations

- Enemies use local steering, not path planning. With this map they rarely get stuck, but a dense custom layout could trap them behind concave shapes.
- There is no swept collision. It is safe at the configured speeds (see above), but much faster projectiles would need it.
- Audio is uncompressed WAV from the pack, about 6 MB, loaded with the battle. Converting it to compressed formats would cut load time.
- Visual baselines are recorded on Windows and need re-recording on other platforms.
- The menu sea keeps simulating up to six ships while a menu is open; its cost has not been profiled yet.
- Profiling covers one desktop machine and an 84 s match so far; see [docs/performance.md](docs/performance.md).
