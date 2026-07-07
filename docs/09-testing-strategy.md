# Espacio Pro v1 — Testing Strategy

> Source of truth for **how** Espacio Pro is tested end-to-end, with explicit
> rules about backend dependency, parallelism, and dev-environment limits.
> Companion to `08-acceptance-criteria.md`.

The live inventory of every test (one row per `test()`) lives next to the
code at [`e2e/TEST_INVENTORY.md`](../e2e/TEST_INVENTORY.md) and **must** be
updated in the same PR that adds, renames, or removes a test.

---

## 1. Why we govern E2E tests

The dev environment is a **single Function App Consumption (FC1)** in front of
a **shared Cosmos DB serverless** account. It is not sized for load testing:
running 7+ Playwright workers in parallel that all POST to `/students` or
`/enrollments` will:

- Saturate Cosmos RU/s and cause 429s.
- Leave Function App cold-instance scale-out behind, so requests hang past 30 s.
- Trigger blank-page renders because reads time out.

We avoid that by classifying tests up-front and choosing the right subset for
the situation (local pre-commit, PR review, full regression, manual exploratory).

---

## 2. Test tiers

Each `test()` belongs to **exactly one tier** (tag). Tiers are mutually
exclusive and reflect *cost + risk*, not feature area.

| Tier             | Tag          | Latency target | Backend writes | When to run                                                     |
|------------------|--------------|----------------|----------------|-----------------------------------------------------------------|
| Smoke            | `@smoke`     | ≤ 5 s          | None           | Pre-push, pre-deploy gate, every PR                             |
| Regression       | `@regression`| ≤ 15 s         | Optional (≤1)  | Before merging a feature PR, nightly                            |
| Write-heavy      | `@write-heavy` | ≤ 90 s       | ≥1 POST/PUT/DELETE that depends on backend latency | Manual, serial workers, when backend is warm                    |

Additional **non-exclusive** tags:

| Tag               | Meaning                                                            |
|-------------------|--------------------------------------------------------------------|
| `@mocked`         | Uses `mockEspacioProApi`; no real HTTP traffic                     |
| `@backend-read`   | Reads from real backend but does not mutate                        |
| `@backend-write`  | Mutates real backend; **always** also `@write-heavy`               |
| `@session-features` | Validates a recently shipped UX flow (replaces ad-hoc smoke checks until promoted to `@regression`) |
| `@desktop-only` / `@mobile-only` | Restrict to one Playwright project (see §5) |

Rules:

1. Every test has **one** tier tag (`@smoke`, `@regression`, or `@write-heavy`).
2. Every test has **one** backend-dependency tag (`@mocked`, `@backend-read`,
   or `@backend-write`).
3. `@backend-write` implies `@write-heavy`.
4. Tags live in the `test()` title string so Playwright `--grep` works:
   `test('opens wizard @smoke @mocked', ...)`.

---

## 3. Selection commands

Defined in [`e2e/package.json`](../e2e/package.json):

| Command                  | Selects                                | Use case                              |
|--------------------------|----------------------------------------|---------------------------------------|
| `pnpm test:smoke`        | `@smoke`                               | Fast pre-push (~30 s)                 |
| `pnpm test:regression`   | `@regression`                          | PR validation (~3 min)                |
| `pnpm test:safe`         | not `@write-heavy`                     | Default local run; skips backend-stressing tests |
| `pnpm test:mocked`       | `@mocked`                              | Offline / no backend running          |
| `pnpm test:write`        | `@write-heavy`, serial workers         | Manual run when backend is warm       |
| `pnpm test`              | everything (governed by `playwright.config.ts`) | CI nightly only                |

---

## 4. Concurrency policy

Playwright config (`e2e/playwright.config.ts`) caps `workers` by environment:

| Environment    | Workers | Override                           |
|----------------|---------|------------------------------------|
| CI             | 1       | none                               |
| Local default  | 3       | `PW_WORKERS=N pnpm test`           |
| Manual write   | 1 or 2  | `PW_WORKERS=1 pnpm test:write`     |

Rationale: 3 workers × 2 Playwright projects (chromium + mobile) = 6
concurrent browsers, which the dev backend tolerates. Anything higher
produces the blank-page / 60 s-hang failure mode documented in §6.

---

## 5. Project (browser) policy

Two Playwright projects run by default:

- **chromium** (Desktop Chrome, 1280×720)
- **mobile** (iPhone 14, 390×844)

Most tests must pass on **both**. Add `@mobile-only` or `@desktop-only` only
when the feature is genuinely viewport-specific (e.g. hamburger menu open
behavior). When tagging mobile-only, ensure the test opens the sidebar
hamburger before clicking nav links — see `openSidebarIfCollapsed` in
`tests/smoke/navigation.spec.ts`.

---

## 6. Known limits & flake patterns

| Symptom                                              | Likely cause                          | Mitigation                                             |
|------------------------------------------------------|---------------------------------------|--------------------------------------------------------|
| Dialog stays `data-state="open"` past 60 s          | Cosmos throttling, Function cold start | Tag `@write-heavy`, run serial                         |
| Page snapshot shows only `region "Notifications"`    | Backend read timed out                | Reduce workers, retry, or `@mocked` if test is UI-only |
| Table test thinks there are rows but only empty-state copy is rendered | `table tbody tr` also matches the placeholder row | Use `BasePage.hasAnyRowAction(/editar/i, timeout)` before opening row actions |
| `getByText('X')` strict-mode violation               | Substring matches sibling copy        | Use `{ exact: true }` or scope to nearest container    |
| Catalog `"X" ya existe` toast                        | Persisted data from prior run         | Append `Date.now()` suffix to test value               |
| Combobox `.first()` clicks wrong picker              | Index drift after subform expands     | Use `selectFirstCommandItemByLabel` / `…SelectOptionByLabel` |

Whenever a write-flow test fails in `@regression`, classify the cause before
re-running:

- **Real product bug** → fix code, keep the test.
- **Test bug** (selector, race, fixture) → fix test.
- **Environment limit** → promote to `@write-heavy` and skip from default runs.

---

## 7. Adding a new test — checklist

Before merging a PR that adds or modifies a test:

- [ ] Tier tag (`@smoke` / `@regression` / `@write-heavy`) chosen and present in the title.
- [ ] Backend-dependency tag (`@mocked` / `@backend-read` / `@backend-write`) present.
- [ ] If it creates real data, the test uses a per-run unique suffix (`Date.now()`).
- [ ] Passes on both `chromium` and `mobile` projects, or explicitly tagged `@desktop-only` / `@mobile-only` with reason.
- [ ] Selectors prefer `getByRole` / `getByLabel`; for pickers, use the label-based helpers in `BasePage`.
- [ ] Row added or updated in [`e2e/TEST_INVENTORY.md`](../e2e/TEST_INVENTORY.md).
- [ ] If `@write-heavy`, documented in §6 of this doc only if it introduces a new flake class.

---

## 8. Skipping policy

Acceptable reasons to use `test.skip(true, '...')`:

1. **flaky-env**: depends on backend behavior the dev tier cannot reliably provide. Tag `@write-heavy` and link a tracking issue.
2. **requires-seed**: needs catalog/seed data not present in dev. Skip with `test.skip(condition, '...')` instead of `true` so it auto-runs when data exists.
3. **feature-flag**: gated behind a flag not enabled in current env.

Never skip to silence a test failure without a documented reason in the skip
message and a follow-up TODO in `TEST_INVENTORY.md`.

---

## 9. Reference

- Page snapshots and traces: `e2e/test-results/**/error-context.md`
- HTML report: `pnpm exec playwright show-report`
- E2E author agent: [`.github/agents/e2e-tester.md`](../.github/agents/e2e-tester.md)
- Inventory: [`e2e/TEST_INVENTORY.md`](../e2e/TEST_INVENTORY.md)
