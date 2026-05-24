---
applyTo: "front/**"
---

# Next.js Frontend Guidelines

## Stack

Next.js 16 (`output: 'export'`) | React 19 | TypeScript 5 strict | Tailwind 4 | shadcn/ui | TanStack Query 5 | Framer Motion 12 | Clerk | Zod 4

## Critical Rules

- `'use client'` on all pages — NO SSR/Server Components.
- shadcn/ui for all UI — never create custom components if shadcn has one.
- Semicolons (`;`) always. Double quotes (`"`) for strings.
- **Frontend-first**: resolve from cache before calling backend.
- Interfaces tipadas — no `any`.
- UI text in Spanish. Code/comments in English.

## State Management

| Case | Use |
|------|-----|
| UI local | `useState` |
| API data | TanStack Query |
| Auth/user | Clerk hooks |
| UI global | Zustand |

## Responsive (Mobile-First)

- Filters: `w-full sm:w-36`
- Buttons: `w-full sm:w-auto`
- Tables: `<ScrollTable>` (not bare `overflow-x-auto`)
- `SidebarInset`: must have `min-w-0 overflow-hidden`

## Animations

- `<FadeIn>` sections, `<ScaleIn>` modals, `<StaggerList>` card grids, `<CountUp>` KPIs.
- NO animate: scroll, pagination, tooltips, inputs, tables ≥50 rows.
- `EmptyState`/`ErrorState` already animated — no wrapper needed.

## Commands

```bash
npm run dev       # Dev server
npm run build     # Static export
npx shadcn@latest add [component]
```
