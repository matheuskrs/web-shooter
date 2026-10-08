# Pirate Battle

A top-down naval arcade shooter built with **React**, **TypeScript (strict)** and **PixiJS**. Sail between islands, sink Chasers and Shooters, and climb the Captain's Log. Ranking and match history run against a mocked REST API (**MSW**) consumed with **Axios** and **TanStack Query**; **Playwright** covers the flows end to end, including visual regression.

- **Play it:** https://web-shooter-omega.vercel.app
- Design and code decisions: [ARCHITECTURE.md](ARCHITECTURE.md)
- Test report: [docs/test-report.md](docs/test-report.md) · Profiling: [docs/performance.md](docs/performance.md)

## Setup

Requirements: Node.js **22.12+** (developed with Node 24) and npm.

```bash
npm install
npx playwright install chromium   # only needed for the E2E suite
npm run dev                       # http://localhost:5173
```

There are **no environment variables** and no private services: the mock API runs inside the browser in every build, including production.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (React Strict Mode, MSW active) |
| `npm run build` | Type-check and build the production bundle into `dist/` |
| `npm run preview` | Serve the production build on http://localhost:4173 |
| `npm run lint` | ESLint (typescript-eslint strict, React hooks) |
| `npm run typecheck` | TypeScript project check (`tsc -b`) |
| `npm test` | Vitest unit tests (simulation rules, collision math, mock server) |
| `npm run test:e2e` | Playwright suite; builds an `e2e` bundle and serves it on port 4180 |
| `npm run test:e2e:update` | Re-record the visual regression baselines |
| `npm run test:e2e:report` | Open the last HTML report (traces are kept for failed tests) |

## Controls

| Action | Keyboard | Touch (landscape) |
| --- | --- | --- |
| Sail forward | `W` / `↑` | helm, middle button (left side) |
| Turn left / right | `A` `D` / `←` `→` | helm, outer buttons |
| Bow cannon (1 ball) | `Space` | cannons, middle button (right side) |
| Port / starboard broadside (3 parallel balls) | `Q` / `E` | cannons, outer buttons |
| Pause / resume | `Esc` / `P` | pause button (top right) |

Holding a fire key keeps firing at the weapon's cooldown. Movement and firing work at the same time, including with two fingers on touch screens.

**Mobile:** gameplay is designed for **landscape**. In portrait on a touch device the battle pauses and asks you to rotate. Menus work in both orientations.

## Gameplay configuration

All balancing lives in one typed object: [`src/game/config/gameConfig.ts`](src/game/config/gameConfig.ts) (`BASE_GAME_CONFIG`). It covers session time, spawn interval, spawn weights and the alive cap, health, movement and rotation speeds, projectile damage, speed and range, cooldowns, and the Shooter's attack, preferred and minimum ranges. Systems only read from it.

The Options screen exposes the two values the challenge asks for:

| Option | Range | Step | Default |
| --- | --- | --- | --- |
| Game session time | 60 – 180 s | 10 s | 120 s |
| Enemy spawn time | 1 – 10 s | 0.5 s | 3 s |

Options are validated and only persist when you press **Save**; they survive a refresh. Every match runs on a frozen snapshot taken when it starts, so changing Options mid-match only affects the next one. Rankings only compare matches with the same configuration key (`r<ruleset>-t<session>-s<spawn>`).

## Network scenarios (mock API)

Open **Options → Network simulation** to pick a scenario, retry pending uploads or **Reset mock server**. Reset restores the initial fixtures, clears registered matches and selects *Success*. A scenario can also be chosen by URL, for demos and bug reports, for example `/?scenario=out-of-order`.

| Scenario id | Behaviour |
| --- | --- |
| `success` | 300 ms latency, everything works |
| `empty` | Ranking and history return no rows |
| `many-pages` | 57 ranking rows / 23 history rows to exercise pagination |
| `slow` | Every response takes 2 s |
| `variable-latency` | Seeded latency between 150 ms and 1.8 s per request |
| `out-of-order` | Odd requests answer after 2.2 s, even ones after 0.25 s |
| `timeout` | The server never answers (client times out after 5 s, retries twice) |
| `connection-error` | Network-level failure |
| `http-400` / `http-500` | Every request fails with that status |
| `ranking-failure` / `history-failure` | Only that endpoint fails |
| `register-timeout-after-commit` | The match is stored, the first reply is lost; the retry returns the same record |
| `register-unavailable` | Registering returns 503 at match end; lists still work |

Latency and failures are deterministic (seeded by request index), so a scenario behaves identically on every run.

### Reproducing failures by hand

- **Pending registration and recovery:** choose *Service unavailable at match end*, play a match, and the result shows *Not logged yet*. Switch back to *Success*, then reload or press *Retry now*. The match is registered once.
- **Timeout without duplicates:** choose *Timeout after registering* and finish a match. The client times out, retries, and receives the record the server already stored. History and ranking each show it once.
- **Stale responses:** choose *Out-of-order responses*, wait for page 1, then click next, next, previous quickly. The late page 3 response never replaces the page you are looking at.
- **Asset failure:** block `ships_miscellaneous_sheet*.png` in DevTools (Network → Block request URL) and press Play. An error with **Retry** appears; unblock it and retry.

## Testing

- **Unit (Vitest):** fixed timestep, collision geometry, simulation rules (movement, islands, cooldowns, single-hit projectiles, scoring, Chaser ram, Shooter range, spawn mix, determinism) and the mock server (idempotency, ordering, pagination).
- **E2E (Playwright):** 12 areas from the challenge brief, in `e2e/`, on desktop Chromium and mobile Chromium (Pixel 7, landscape). Tests use a fixed seed and a manual simulation clock (`?seed=…&clock=manual`, only available in non-production builds). Every action goes through real keyboard or touch input; the small test API only observes state, advances the clock and places ships. Visual baselines for the menu, a stable arena and the result screen are versioned in `e2e/visual.spec.ts-snapshots/` (recorded on Windows; other platforms need `npm run test:e2e:update` once).

## Profiling

Append `?perf` to any URL, production included, to show a live overlay. It reports FPS, p95 frame interval, entity counts, live sessions, attached listeners, audio loops and JS heap. The result screen then offers the whole match's report as JSON. The procedure and the report template are in [docs/performance.md](docs/performance.md).

## Deploy

The output is a static site (`npm run build` → `dist/`) with hash-based routing, so no rewrites are needed. On Vercel: import the repository and keep the Vite defaults (build `npm run build`, output `dist`). The MSW worker (`/mockServiceWorker.js`) is served from the site root and starts automatically.

## Assets and credits

- Game art, UI atlas and sounds: the Pirate Battle asset pack provided with the challenge (`assets/`), used unmodified. The ship and tile art appear to come from Kenney's *Pirate Pack* (CC0).
- Font: [Lilita One](https://fonts.google.com/specimen/Lilita+One) by Juan Montoreano, SIL Open Font License 1.1, bundled via `@fontsource/lilita-one`.
- Generated at runtime: soft trail, ripple and glow textures painted on canvas (the pack has no such sprites).
