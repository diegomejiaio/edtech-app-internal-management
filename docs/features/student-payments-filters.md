# UX Spec — Filtros de "Pagos de alumnos" (fecha + búsqueda)

Implementation-ready spec for adding a **date filter** and a **student-name search** to the
Student Payments list (`frontend/src/app/(app)/student-payments/page.tsx`). Server-side only;
keeps the existing "load more" (infinite) pagination.

> Evidence basis: this spec is grounded in the existing code/contract (observed), not in user
> interviews. Treat interaction choices (preset set, default = current month) as **hypotheses**
> to validate with the product owner / real admins before locking. The PO already requested this
> scope, so requirements are reported, not assumed.

---

## 0. Backend contract (what exists vs. what's needed)

| Capability | Status | Notes |
|---|---|---|
| `from` / `to` (ISO `YYYY-MM-DD`, inclusive) | ✅ exists | `StudentPaymentRepository.SearchAsync`: `c.date >= @from AND c.date <= @to` |
| `limit` / `offset`, `total` count | ✅ exists | `Paginated<T>` already drives `DataTable.total` |
| Name search (`q` / `search`) | ❌ **missing** | Needs a new param + `CONTAINS(LOWER(c.studentName), @q)` clause |
| Range total amount (`SUM(amount)`) | ❌ **missing** | Optional; cheap aggregate. Needed for "Total S/" summary |

These two backend additions are the only server work. Everything else reuses existing components.

---

## 1. Filter bar — layout & responsive behavior

Place a `<FilterBar>` between `<PageHeader>` and `<DataTable>`.

**Desktop (`sm:` and up)** — single row, `items-end`:

```
[ 🔍 Buscar por nombre del alumno…            (grows, flex-1) ] [ 📅 Este mes (jun 2026) ▾ ] [ Limpiar ]
```

- Order: **Search (left, `flex-1`)** → **Date control (fixed width)** → **`ClearFiltersButton`** (in `FilterBarActions`, pushed right with `sm:ml-auto`).
- Search left because it's the per-task action; the date control is the standing scope and reads as a stable "chip".

**Narrow (mobile, default `flex-col`)** — stack full-width, in this order:

```
[ 🔍 Buscar por nombre del alumno…           (w-full) ]
[ 📅 Este mes (jun 2026) ▾                    (w-full) ]
[ Limpiar ]   ← only visible when filters differ from defaults
```

`FilterBar` already does `flex flex-col gap-4 sm:flex-row sm:items-end`, so no new layout code.

---

## 2. Date filter — interaction

A **single `Popover`** trigger (an outline `Button` with a calendar icon) that always shows the
**active range**. The default is the **current month**, never empty (a payments list is always scoped to a period).

**Trigger label** reflects current state:
- Preset active → `Este mes (jun 2026)`, `Hoy (30/06/2026)`, `Mes pasado (may 2026)`.
- Custom active → `01/05/2026 – 15/06/2026`.

**Popover content:**
1. A vertical preset list (radio semantics, `role="radiogroup"`):
   - **Hoy** → `from = to = hoy`
   - **Este mes** (default, selected on first load) → `monthRange(currentMonth())`
   - **Mes pasado** → `monthRange(previous month)`
   - **Personalizado** → reveals the `Calendar` in `mode="range"`
2. When **Personalizado** is chosen, show `<Calendar mode="range">` + a footer with **`Aplicar`** (primary) and **`Cancelar`**. The range is applied only on `Aplicar` (avoids firing a query on every half-selected click).
3. Selecting any **preset** applies immediately and closes the popover.

**Helpers to use (no new date math):** `currentMonth()`, `monthRange()`, `toIsoDate()` from
`@/lib/dashboard-period`. For "Hoy"/"Mes pasado" derive with `date-fns` (`subMonths`, `startOfMonth`,
`endOfMonth`) and convert with `toIsoDate`. Payment `date` is a plain `YYYY-MM-DD` string → **no
timezone conversion needed**; pass `from`/`to` straight through.

**Showing the active range:** the trigger label is the source of truth. Optionally render a small
`Badge` next to the title when a non-default custom range is active (e.g. `Personalizado`).

**Clearing:** the date control never clears to empty. **`Limpiar`** resets the whole bar to defaults
(search empty + date = **Este mes**). Inside the popover, "Personalizado" can be abandoned with
`Cancelar`, reverting to the last applied range.

---

## 3. Search — interaction

Reuse `<SearchInput>` (it already has the icon + inline `InlineSpinner`).

- **Placeholder:** `Buscar por nombre del alumno…`
- **Label (visually-hidden or `mb-1` muted):** `Buscar pago`
- **Debounce:** **350 ms** after the last keystroke before issuing the request. Trim whitespace;
  collapse internal multiple spaces. Empty string ⇒ omit the `q` param entirely (no name filter).
- **Min length:** none (1+ char queries are fine server-side; `CONTAINS` is case-insensitive).
- **Searching state:** pass `isSearching={isFetching && debouncedQuery !== ''}` so the spinner shows
  during the round-trip (keep previous rows visible via `keepPreviousData`, don't blank the table).
- **Clear:** add a small `X` button inside the input (right side) when value is non-empty; clicking it
  empties the field and refocuses it. (`SearchInput` currently lacks this — add a `onClear` prop or an
  absolutely-positioned `Button variant="ghost" size="icon"`.) `Limpiar` also clears it.
- **Combine with date:** search and date are **AND-combined**, both sent as query params
  (`?from=&to=&q=`). The active date range is **never** widened by searching — a search finds payments
  *within the current range*. Surface this in the empty state (see §5) so users aren't confused when a
  known student doesn't appear because they paid outside the range.

Both controls feed one query key; any change resets the infinite query to `offset = 0`.

---

## 4. Results summary (count + optional total)

Two layers, both reusing existing patterns:

1. **`TableFooter`** (already wired into `DataTable`): set `entityName="pagos"`,
   `isFiltered={hasActiveFilters}`, `totalCount={total}`. It renders e.g.
   `Mostrando 25 de 143 pagos (hay más)` or, when filtered, `12 resultados de búsqueda`.

2. **Range summary line** above the table (small, `text-sm text-muted-foreground`), right-aligned in
   the filter row or just under it:

   - With backend `SUM`: **`143 pagos · Total S/ 18 450.00 — Este mes (jun 2026)`**
   - Singular: **`1 pago · Total S/ 120.00 — Hoy (30/06/2026)`**
   - If the SUM endpoint isn't built yet, show **count only**: `143 pagos — Este mes (jun 2026)`.
     Do **not** sum only the loaded page client-side and label it "Total" — that would be misleading
     with infinite scroll. Either show the true server SUM or omit the amount.

Money format: keep the page's existing `S/ {n.toFixed(2)}` for parity with the table.

---

## 5. No-results / empty states

Use `<EmptyState>` (it has `hasFilters` + `filterDescription`).

- **No payments at all (no filters):** `title="No hay pagos registrados"`,
  `description="Los pagos de alumnos aparecerán aquí."`, action `Nuevo pago`.
- **Filters active, nothing matched:** `hasFilters` → `title="No se encontraron pagos"`,
  `filterDescription="No hay pagos para «{q}» en {rango}. Prueba con otro nombre o amplía el rango de fechas."`
  Include a quick **`Ver este mes`** / **`Limpiar filtros`** secondary action.
- **Search with date active** (the trap): the message above explicitly names both the term and the
  range so the user understands the AND-scope.

---

## 6. Accessibility checklist (WCAG AA)

**Search**
- [ ] Input has a programmatic label (`<label htmlFor>` or `aria-label="Buscar pago"`); placeholder is not the only label.
- [ ] Clear (`X`) button has `aria-label="Limpiar búsqueda"`, is keyboard-reachable, 24×24px min target.
- [ ] Spinner state announced: `aria-busy="true"` on the input wrapper while fetching.
- [ ] Result count region is `aria-live="polite"` so screen readers hear "12 resultados" after a search settles.

**Date popover**
- [ ] Trigger `Button` has `aria-haspopup="dialog"`, `aria-expanded`, and an accessible name that includes the current range (e.g. `Filtrar por fecha: Este mes, junio 2026`).
- [ ] Presets are a `role="radiogroup"` with `aria-checked` on the active option; operable with arrow keys + Enter/Space.
- [ ] `Calendar` (range mode) is fully keyboard-navigable; focus moves into the popover on open and returns to the trigger on close (Radix Popover handles this — verify).
- [ ] `Esc` closes the popover; `Aplicar`/`Cancelar` reachable by Tab.

**General**
- [ ] Visible focus ring on every control (search, clear, trigger, presets, Aplicar, Limpiar).
- [ ] Logical tab order: Search → Clear → Date trigger → Limpiar → table.
- [ ] Active range/term not conveyed by color alone — it's text in the trigger label and summary line.
- [ ] Layout and the popover remain usable at 200% zoom (stacks via `flex-col`).
- [ ] Text contrast ≥ 4.5:1 (use `text-muted-foreground` on light bg — verify token meets AA).

---

## 7. Microcopy (es-PE)

| Element | String |
|---|---|
| Search placeholder | `Buscar por nombre del alumno…` |
| Search a11y label | `Buscar pago` |
| Clear search | `Limpiar búsqueda` |
| Date trigger a11y prefix | `Filtrar por fecha` |
| Preset: today | `Hoy` |
| Preset: this month (default) | `Este mes` |
| Preset: last month | `Mes pasado` |
| Preset: custom | `Personalizado` |
| Custom apply / cancel | `Aplicar` / `Cancelar` |
| Clear-all button | `Limpiar` |
| Summary (count + total) | `{n} pago(s) · Total S/ {monto} — {rango}` |
| Footer (filtered) | `{n} resultado(s) de búsqueda` |
| Empty (no data) | `No hay pagos registrados` / `Los pagos de alumnos aparecerán aquí.` |
| Empty (filtered) | `No se encontraron pagos` / `No hay pagos para «{q}» en {rango}. Prueba con otro nombre o amplía el rango de fechas.` |
| Empty quick actions | `Ver este mes` · `Limpiar filtros` |

---

## 8. Edge cases

- **No payments in range** → filtered `EmptyState`; offer `Ver este mes` (reset to default) — never auto-widen the range silently.
- **Search active + date scoping out the match** → empty message names both term and range so the user knows to widen dates.
- **Very large custom range** (e.g. full year): allowed; pagination stays "load more", so cost is bounded. Show count in the summary; if `SUM` is enabled it stays a single cheap aggregate. Consider a soft hint if `to - from > 366 días`: `Rango amplio: los resultados se cargan por páginas.` (non-blocking).
- **Invalid custom range** (`from > to`): disable `Aplicar`; show inline `La fecha inicial debe ser anterior a la final.` Backend also 400s on bad ISO via `req.ValidationError("from", …)`.
- **Rapid typing**: debounce (350 ms) + `keepPreviousData` prevents flicker and request storms; cancel in-flight on new query key.
- **Result while loading more**: changing search/date resets `offset` to 0 (new query key) — discard accumulated pages to avoid mixing scopes.
- **Single result / singular grammar**: use `pago`/`resultado` (singular) when `n === 1`.

---

## 9. Backend changes required (handoff to API)

1. **Name search** — add `q` (or `search`) to `GET /student-payments`; in `SearchAsync` append
   `AND CONTAINS(LOWER(c.studentName), @q)` (Cosmos `CONTAINS(..., true)` for case-insensitive).
   Add `q` to `StudentPaymentListParams` (frontend `lib/api/student-payments.ts`) and thread through
   `useInfiniteStudentPayments`.
2. **Range total (optional but recommended)** — `SELECT VALUE SUM(c.amount)` with the same `WHERE`
   used by the list, exposed either as an extra field on the paginated response or a sibling endpoint
   `GET /student-payments/summary?from=&to=&q=`. Without it, render count-only (do not fake a total
   from loaded rows).

→ Hand off items 1–2 to **`product-manager-advisor`** for issue creation / prioritization, and to a
backend engineer for feasibility on the Cosmos `CONTAINS` index/RU cost.
