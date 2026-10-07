# Test report

Results of the last full local run. Regenerate them with `npm test` and `npm run test:e2e`; the interactive HTML report (with traces for any failure) opens with `npm run test:e2e:report`.

| | |
| --- | --- |
| Date | 2026-10-07 |
| OS | Windows 11 Pro (10.0.26200) |
| Node.js | 24.13.0 |
| Playwright | 1.63.0, Chromium 153.0.8010.12 (headless, software WebGL) |

## Unit tests (Vitest)

**25 passed** across 4 files:

- `FixedStepLoop.test.ts`: frame-rate independence, catch-up cap, reset
- `geometry.test.ts`: circle against rounded rectangle and circle, rounded corners, deep penetration
- `stepSimulation.test.ts`: movement, arena bounds, island blocking, single-hit damage and scoring, broadside spread, cooldowns, Chaser ram (no score), Shooter range keeping, spawn mix, time-up stop, seed determinism
- `mockServer.test.ts`: idempotent registration, conflicting replay, validation, config-scoped ranking, tie-break order, pagination, empty scenario

## End-to-end (Playwright)

**73 passed, 3 skipped**, in about 2 minutes with 3 workers. The suite passed twice in a row with no retries. The 3 skips are the touch specs on the desktop project, which only run on the mobile project.

| Challenge requirement | Spec |
| --- | --- |
| 1. Options navigation, validation, persistence | `options.spec.ts` |
| 2. Asset loading, failure and retry | `assets.spec.ts` |
| 3. Start, movement, rotation, arena limits, islands | `movement.spec.ts` |
| 4. Bow and broadside fire, damage, cooldown, score without duplicates | `combat.spec.ts` |
| 5. Chaser and Shooter behaviour, spawn interval | `enemies.spec.ts` |
| 6. End by time and by death, simulation stop, clean restart | `match-end.spec.ts` |
| 7. Pause, focus loss, resume without timer drift | `pause.spec.ts` |
| 8. Result display and persistence after refresh | `match-flow.spec.ts` |
| 9. Abandoning a match, repeated navigation, touch controls | `match-flow.spec.ts`, `touch.spec.ts` |
| 10. Ranking and history paging, loading, empty, errors | `captains-log.spec.ts` |
| 11. Registration, both tabs updated, pending recovery after refresh | `registration.spec.ts` |
| 12. Retry after timeout without duplicates, late responses | `registration.spec.ts` |
| Visual regression: menu, arena, result | `visual.spec.ts` |

Projects: `desktop-chromium` (1280 × 720) runs every spec; `mobile-chromium` (Pixel 7, landscape, touch) runs options, navigation, touch, Captain's Log, match flow and visual specs.
