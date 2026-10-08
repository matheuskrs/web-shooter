# Performance report

Target: **60 FPS** during combat in an optimized build. This document describes the instrumentation and the procedure; the results tables are filled in from real runs on the reference machine and must not contain estimates.

## Instrumentation

Add `?perf` to the URL of any build, production included.

- **Battle overlay** (live, last ~2 s): FPS, p95 and max frame interval, entities (ships, cannonballs, effect particles), live/created sessions, attached listeners, audio loops, JS heap (Chrome only).
- **Match report**: at the end of each match the session stores the full-match figures (average FPS, p95/p99/max frame interval from every ticker frame, peak entity count and breakdown, viewport, DPR, user agent). The result screen shows a summary and a **Copy profiling JSON** button.

Frame intervals come from the Pixi ticker's real `deltaMS`, measured only while the match is running (pauses excluded). The monitor exists only in `?perf` mode, so normal play pays nothing for it.

## Procedure

1. `npm run build && npm run preview`, then open `http://localhost:4173/?perf` in Chrome with no other heavy tabs. Use a normal window, not DevTools device emulation.
2. **Three-minute match:** in Options set *Game session time* to 180 s and *Enemy spawn time* to 3 s, then Save. Play the full match actively, keeping the arena busy (broadsides, several enemies alive).
3. At the result screen press **Copy profiling JSON** and keep the report.
4. **Memory over five cycles:** open DevTools → Memory. Take a heap snapshot on the menu (baseline). Then repeat five times: Play → sail and fire for ~20 s → Pause → Main Menu. Press the garbage-collection button and take a second snapshot. Compare the two, filtering for `Sprite`, `Container`, `Texture`, `Application`, `AudioBufferSourceNode` and detached `HTMLCanvasElement`. Also check that the overlay of the next battle shows `sessions 1 live` and `listeners 5`.
5. Optionally record a Performance trace for 10 s of heavy combat to inspect long frames.

## Reference environment

| Field | Value |
| --- | --- |
| CPU | AMD Ryzen 7 5700X (8 cores) |
| GPU | AMD Radeon RX 9060 XT |
| RAM | 16 GB |
| OS | Windows 11 Pro |
| Browser | Chrome 155 (desktop) |
| Display | 1920 × 1080 @ 180 Hz; browser viewport 1920 × 945, DPR 1 |
| Build | production deployment (https://web-shooter-omega.vercel.app/?perf) |
| Match configuration | 180 s session, 3 s spawn interval, ruleset 1 |

## Results: match run

Measured on 2026-10-08 from the in-game report (`?perf`, "Copy profiling JSON"). Frame intervals are the Pixi ticker's real deltas, collected only while the match was running.

| Metric | Value |
| --- | --- |
| Effective match duration | 83.9 s (the match ended before the 180 s limit) |
| Frames recorded | 15 095 |
| Average FPS | 180.0 |
| p95 frame interval | 5.70 ms |
| p99 / max frame interval | 5.70 ms / 5.80 ms |
| Peak entities | 64 (6 ships, 2 cannonballs, 54 effect particles, 2 sinking wrecks) |
| JS heap at the result screen | 18.0 MB |

**Reading the numbers.** The display refreshes at 180 Hz and the browser synchronises frames to it, so 180 FPS is the vsync ceiling, not the game's limit. The p95 and the worst frame (5.8 ms) both sit at the 5.56 ms refresh interval, meaning no frame was dropped during the run. The 60 FPS target (16.7 ms per frame) is met with about 3× headroom on this machine.

At the result screen the counters read 2 sessions created and 1 disposed. That is expected: the finished match stays on screen behind the result until the player leaves, and the earlier match had already been disposed.

## Results: five start → play → leave cycles

Not measured yet. Follow step 4 of the procedure above and record the heap snapshots here.

| Metric | Baseline | After 5 cycles |
| --- | --- | --- |
| JS heap after GC | – | – |
| Live `Application` / `Sprite` / `Texture` objects | – | – |
| Detached canvases | – | – |
| Overlay: live sessions / listeners | – | – |

What *is* verified automatically: the E2E suite (`match-flow.spec.ts`, `world.spec.ts`) runs repeated start → leave cycles and asserts that every match session is disposed (`live === 0`) and that a single canvas exists.

## Observations and limitations

- The recorded match lasted 83.9 s of active play, not the full three minutes the brief asks for. A full 180 s run is still pending.
- One machine and one browser only. Low-end and mobile devices have not been profiled; there the motion blur already uses fewer samples on touch screens.
- Effect particles peaked at 54 and dominate the entity count. They are created per effect rather than pooled; at this frame time pooling is not needed.
- Not measured: the menu's attract world (up to six ships) and the camera travel with motion blur. Both run only outside a match.

### Expected costs, for context

These are design facts, not measurements:

- Each Play creates a new Pixi `Application` and uploads the textures to its WebGL context, so the first frames after Play can be slower.
- Effect particles are created and destroyed per effect rather than pooled. The peak entity count in the report shows whether pooling would be worthwhile.
- Islands are baked once with `cacheAsTexture`; the water consists of two `TilingSprite`s.
