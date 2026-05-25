# E2E Test Inventory

> Living inventory of every Playwright test. **Update in the same PR that adds,
> renames, removes, or re-tags a test.** Governance rules and tag taxonomy live
> in [`docs/09-testing-strategy.md`](../docs/09-testing-strategy.md).

Columns:

- **Tier**: `smoke` · `regression` · `write-heavy` (one per test).
- **Backend**: `mocked` · `read` · `write`.
- **Status**: `active` · `skipped(reason)`.

---

## smoke/

### `tests/smoke/navigation.spec.ts` — Navigation @smoke

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | should load dashboard after login | smoke | read | active | Mobile opens hamburger first |
| 2 | should navigate to students page | smoke | read | active | |
| 3 | should navigate to collections page | smoke | read | active | |

### `tests/smoke/dashboard-enrollment.spec.ts` — Dashboard enrollment action @smoke

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | should open the wizard-style enrollment flow from the dashboard action | smoke | mocked | active | `mockEspacioProApi` |

---

## regression/

### `tests/regression/animations.spec.ts` — Table row animations @session-features

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | does not flash existing rows orange on initial list load | regression | read | active | Requires seeded rows |
| 2 | flashes a new student row orange, then removes it after delete | write-heavy | write | skipped(flaky-env) | Hangs under parallel load |

### `tests/regression/dashboard-enrollment-wizard.spec.ts` — Dashboard enrollment wizard @session-features

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | opens the unified Nueva matrícula wizard from dashboard | smoke | read | active | |
| 2 | creates an enrollment from the dashboard wizard | write-heavy | write | active | `test.setTimeout(90_000)` |

### `tests/regression/enrollment-payments-block.spec.ts` — Enrollment payments block @session-features

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | lists payments when editing an enrollment | regression | read | active | |
| 2 | registers and deletes a student payment tied to the enrollment | write-heavy | write | active | `test.setTimeout(90_000)` |

### `tests/regression/forms-filters.spec.ts` — Form spacing and payment filters @session-features

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | keeps visible label/input gaps in Nuevo pago profesor | regression | read | active | UI-only check |
| 2 | keeps visible label/input gaps in Nuevo gasto | regression | read | active | UI-only check |
| 3 | does not render date filters in student payments toolbar | regression | read | active | |

### `tests/regression/search-placeholders.spec.ts` — Search placeholders and phone search @session-features

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | shows the expected search placeholders | regression | read | active | |
| 2 | filters students by phone number | write-heavy | write | skipped(flaky-env) | Creates seed via API |
| 3 | filters teachers by phone number | write-heavy | write | skipped(flaky-env) | Creates seed via API |

### `tests/regression/spaces.spec.ts` — Spaces @regression

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | should display spaces page | regression | read | active | |
| 2 | should show empty state when no spaces exist | regression | read | active | Conditional skip |
| 3 | should open new space form | regression | read | active | Form open only, no submit |

### `tests/regression/student-payments.spec.ts` — Student payments @regression

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | should default the new payment date to today | regression | mocked | active | `mockEspacioProApi` |
| 2 | should show payment history and balance summary after selecting an active enrollment | regression | mocked | active | `mockEspacioProApi` |

### `tests/regression/student-sources.spec.ts` — Student Sources catalog @regression

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | should display student sources page | regression | read | active | |
| 2 | should show existing source items | regression | read | active | |
| 3 | should add a new source | write-heavy | write | active | Uses unique suffix |

### `tests/regression/students.spec.ts` — Students CRUD @regression

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | should display students table | regression | read | active | |
| 2 | should filter students by search | regression | read | active | Conditional skip if empty |
| 3 | should open new student form | regression | read | active | Open only, no submit |

### `tests/regression/ui-copy.spec.ts` — Implemented UI copy @regression

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | should show collections placeholder copy | regression | mocked | active | |
| 2 | should mention phone in students search placeholder | regression | mocked | active | |
| 3 | should mention phone in teachers search placeholder | regression | mocked | active | |

### `tests/regression/weekdays.spec.ts` — Weekdays catalog @regression

| # | Test | Tier | Backend | Status | Notes |
|---|------|------|---------|--------|-------|
| 1 | should display weekdays page | regression | read | active | |
| 2 | should show existing weekday items | regression | read | active | |
| 3 | should add a new weekday value | write-heavy | write | active | Uses unique suffix |

---

## Totals

| Tier         | Count |
|--------------|-------|
| smoke        | 6     |
| regression   | 20    |
| write-heavy  | 7     |
| **active**   | **30** |
| **skipped**  | **3** (flaky-env) |
| **total**    | **33** unique × 2 projects = **66** executions |

---

## Skip backlog

| Test | Reason | Re-enable path |
|------|--------|----------------|
| animations › flashes a new student row | backend hang under parallel load | Mock `POST /students` or run serial via `pnpm test:write` |
| search-placeholders › filters students by phone | seed POST hangs under load | Mock seed or move to `pnpm test:write` |
| search-placeholders › filters teachers by phone | seed POST hangs under load | Mock seed or move to `pnpm test:write` |

---

## How to update

1. **New test** → add a row in the right table; pick tier + backend tags before writing code.
2. **Renaming/removing** → update the row in the same PR.
3. **Promoting `@session-features` → `@regression`** → move the tag and update `Tier` column.
4. **Promoting `@write-heavy` back to `@regression`** → only after the test no longer creates real data (e.g. switched to `mockEspacioProApi`).
