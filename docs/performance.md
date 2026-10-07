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
| CPU / GPU | _fill in_ |
| RAM | _fill in_ |
| OS | _fill in_ |
| Browser and version | _fill in_ |
| Window resolution / DPR | _fill in (also in the JSON report)_ |
| Build | production (`npm run build`), `?perf` |
| Match configuration | 180 s session, 3 s spawn interval, ruleset 1 |

## Results: three-minute match

| Metric | Value |
| --- | --- |
| Average FPS | _from report_ |
| p95 frame interval | _from report_ |
| p99 / max frame interval | _from report_ |
| Peak entities (ships / balls / effects) | _from report_ |
| Effective match duration | _from report_ |

## Results: five start → play → leave cycles

| Metric | Baseline | After 5 cycles |
| --- | --- | --- |
| JS heap after GC | _fill in_ | _fill in_ |
| Live `Application` / `Sprite` / `Texture` objects | _fill in_ | _fill in_ |
| Detached canvases | _fill in_ | _fill in_ |
| Overlay: live sessions / listeners | – | _fill in_ |

## Observations and limitations

_Record what was observed (for example long frames on first Play while textures upload, behaviour at peak effects) and anything that could not be measured._

### Expected costs, for context

These are design facts, not measurements:

- Each Play creates a new Pixi `Application` and uploads the textures to its WebGL context, so the first frames after Play can be slower.
- Effect particles are created and destroyed per effect rather than pooled. The peak entity count in the report shows whether pooling would be worthwhile.
- Islands are baked once with `cacheAsTexture`; the water consists of two `TilingSprite`s.
