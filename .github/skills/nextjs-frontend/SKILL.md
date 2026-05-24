---
name: nextjs-frontend
description: >
  Next.js 16 static export (SPA) frontend guidelines for Espacio Pro.
  Trigger: When writing or modifying frontend components, pages, hooks, or UI code.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Writing new pages or components in `src/`
- Modifying existing frontend code
- Adding new TanStack Query hooks
- Implementing UI patterns with shadcn/ui
- Adding animations with Framer Motion
- Working on responsive layouts

## Stack

Next.js 16 (`output: 'export'`) | React 19 | TypeScript 5 strict | Tailwind 4 | shadcn/ui | TanStack Query 5 | Framer Motion 12 | Clerk | Zod 4

## Critical Rules

| ✅ SIEMPRE | ❌ NUNCA |
|------------|----------|
| `'use client'` en páginas | SSR/Server Components |
| shadcn/ui para UI | Componentes UI custom |
| Interfaces tipadas | `any` en TypeScript |
| Textos español (usuario) | Hardcodear colores |
| Código/comments inglés | Animaciones complejas |
| **Punto y coma (`;`)** al final de statements | Omitir punto y coma |
| **Comillas dobles (`"`)** para strings | Comillas simples (`'`) |
| **Frontend-first**: resolver en cache si el dato ya existe | Llamar al backend si el frontend ya tiene el dato |

## Frontend-first / Backendless by Default

Antes de agregar cualquier llamada al backend, pregúntate: **¿el frontend ya tiene este dato?**

| ✅ Resolver en frontend | ❌ No llamar al backend |
|------------------------|------------------------|
| Actualizar un flag post-mutación (`is_declared`, `is_active`) | Re-fetch después de una mutación exitosa |
| Resumen de counts en un modal de confirmación | Fetch con `enabled: modalOpen` si los datos ya están cargados |
| Counts derivados de una lista ya cargada | Endpoint solo para contar lo que ya se tiene |
| Propagación de datos con prop callbacks (`onCountsChange`) | Re-fetch desde un componente hijo |

```ts
// ✅ Post-mutación: actualizar cache directamente con la response
queryClient.setQueryData(["declaration", id], responseData);

// ✅ Reflejar cambio en todas las variantes de una query cacheada
queryClient.setQueriesData({ queryKey: ["vouchers-stats-by-company"] }, (old) => ({
  ...old,
  items: old.items.map(item =>
    item.company_id === id ? { ...item, is_declared: true } : item
  ),
}));

// ✅ Subir datos ya disponibles con prop callback en vez de re-fetch
<VouchersTable onCountsChange={setValidationCounts} />

// ❌ Fetch de algo que ya está en el árbol de componentes
useQuery({ queryKey: ["counts"], queryFn: () => api.get("/vouchers?limit=1"), enabled: modalOpen })
```

Solo llamar al backend cuando:
- El dato **genuinamente no existe** en el cliente
- Requiere **autorización** que solo el backend puede verificar
- Es un **write** que debe persistirse

## Structure

```
src/
├── app/(public)/, (app)/, (admin)/   # Rutas
├── components/ui/                     # shadcn (NO TOCAR)
├── components/motion/                 # FadeIn, ScaleIn, HoverLift
├── hooks/use-*.ts                     # TanStack Query hooks
├── lib/api.ts, utils.ts
└── types/
```

## State Management

| Caso | Usar |
|------|------|
| UI local (modal, toggle) | `useState` |
| Datos del API | TanStack Query |
| Cache, refetch | TanStack Query |
| Auth/user | Clerk hooks |
| UI global (sidebar) | Zustand |

```tsx
// ❌ MAL
useEffect(() => { fetch('/api').then(setData) }, [])

// ✅ BIEN
const { data } = useQuery({ queryKey: ['key'], queryFn: fetchFn })
```

## Pagination & Search

### Paginated Response Type

```tsx
interface CursorPaginatedResponse<T> {
  items: T[]
  total_count?: number
  next_cursor?: string
  has_more: boolean
}
```

### Infinite Query Hook

```tsx
useInfiniteQuery({
  queryKey: ['items', params],
  queryFn: ({ pageParam }) => api.get('/items', { cursor: pageParam, ...params }),
  getNextPageParam: (last) => last.has_more ? last.next_cursor : undefined,
})
```

### Search: Local-first → Server Fallback

1. Usuario escribe → filtrar datos cargados (instantáneo)
2. Sin resultados locales → debounce 400ms → servidor
3. Mostrar spinner mientras busca

```tsx
const [search, setSearch] = useState("")
const [debouncedSearch, setDebouncedSearch] = useState("")
const localFiltered = items.filter(i => i.name.includes(search))

useEffect(() => {
  if (localFiltered.length > 0 || !search) return setDebouncedSearch("")
  const t = setTimeout(() => setDebouncedSearch(search), 400)
  return () => clearTimeout(t)
}, [search, localFiltered.length])
```

### Filters: Backend vs Frontend

| Filtro | Backend | Razón |
|--------|---------|-------|
| `is_active`, `status` | ✅ | Afecta paginación |
| `search` | ✅ | Datos no cargados |
| Ordenamiento | ✅ | Consistencia páginas |

## UI Patterns

### Stats from Backend

```tsx
const total = data?.pages[0]?.total_count ?? 0
```

### Filters with Labels

```tsx
<div className="flex flex-col gap-1">
  <label className="text-xs text-muted-foreground">Estado</label>
  <Select value={filter} onValueChange={setFilter}>...</Select>
</div>
```

### "Ver más" (only without active search)

```tsx
{hasNextPage && !searchQuery && (
  <Button onClick={() => fetchNextPage()}>Ver más</Button>
)}
```

## Animations

| Componente | Uso |
|------------|-----|
| `<FadeIn>` | Entrada secciones |
| `<ScaleIn>` | Modals |
| `<HoverLift>` | Cards interactivas |
| `<StaggerList>` | Listas de cards (companies, notifications) |
| `<CountUp>` | KPI numbers en stats cards |
| `<AnimatePresence mode="wait">` | Crossfade entre estados visuales |

❌ NO animar: scroll, paginación, tooltips, inputs, tablas grandes, tablas fiscales (≥ 50 rows)

### StaggerList

Reemplaza el `<div className="grid ...">` — ES el grid container.

```tsx
<StaggerList
  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
  staggerDelay={0.08}>
  <StatCard label="Total" value={total} icon={Building2} />
  <StatCard label="Activas" value={active} icon={CheckCircle2} />
</StaggerList>
```

| Prop | Default | Descripción |
|------|---------|-------------|
| `className` | `""` | Clase del contenedor (grid/flex) |
| `itemClassName` | `""` | Clase de cada wrapper de item |
| `staggerDelay` | `0.08` | Segundos entre cada item |
| `delay` | `0` | Delay inicial |

Rules:
- ✅ Para grupos de 2–8 cards
- ❌ NO en tablas HTML (`<Table>`, `<TableBody>`)
- ❌ NO wrappear con `<FadeIn>`
- ✅ `staggerDelay={0.08}` para 4 cards, `0.06` para 6+

### AnimatePresence Crossfade

```tsx
<AnimatePresence mode="wait" initial={false}>
  {condition ? (
    <motion.img
      key="state-a"
      src={urlA}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
    />
  ) : (
    <motion.img
      key="state-b"
      src={urlB}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
    />
  )}
</AnimatePresence>
```

### CountUp

```tsx
<CardTitle className="text-2xl font-bold tabular-nums">
  <CountUp target={value} />
</CardTitle>
```

- ✅ Solo en números enteros (conteos, totales)
- ❌ NO en montos con decimales (IGV, totales financieros)
- ✅ `StatCard` ya lo incluye automáticamente

### EmptyState / ErrorState

Already animated — **NO wrappear** with `FadeIn` or `ScaleIn`.

```tsx
// ✅ Directo
<EmptyState
  icon={Building2}
  title="No hay empresas"
  description="Las empresas aparecerán aquí."
  hasFilters={!!searchQuery}
  action={{ label: "Crear empresa", onClick: () => setOpen(true) }}
/>
```

## Auth (Clerk) - Static Export

```tsx
// ✅ Client-side
import { useAuth } from "@clerk/nextjs"
const { isSignedIn, has } = useAuth()
if (!has?.({ permission: "org:feature:access" })) return <AccessDenied />

// ❌ NO usar (requiere SSR)
import { auth } from "@clerk/nextjs/server"
```

**Doble protección:** Frontend = UX, Backend = Seguridad REAL

## Forms

```tsx
const schema = z.object({ name: z.string().min(1) })
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema)
})
```

## shadcn/ui

Installed: `button card input select badge table dropdown-menu dialog tooltip separator skeleton sheet tabs`

Add new: `npx shadcn@latest add [component]`

❌ NUNCA crear componente UI si existe en shadcn

## Responsive Design (Mobile-First)

Breakpoints: Base (mobile) → `sm:` (640px) → `md:` (768px) → `lg:` (1024px)

### Widths

```tsx
// Filtros
width="w-full sm:w-36"
// Botones
className="w-full sm:w-auto"
// Inputs
className="w-full sm:max-w-sm"
// Popovers
className="w-[calc(100vw-2rem)] sm:w-96"
```

### Layouts

```tsx
// Stack → row
className="flex flex-col sm:flex-row gap-2"
// Grid responsive
className="grid grid-cols-2 lg:grid-cols-4 gap-4"
// Filtros grid
className="grid grid-cols-3 sm:flex gap-2"
```

### Typography

```tsx
className="text-xl sm:text-2xl font-bold tabular-nums"
className="text-lg sm:text-2xl font-bold tabular-nums truncate"
```

### Sidebar

```tsx
// App: collapsible="icon"
<Sidebar collapsible="icon">
// Admin: hidden on mobile
className="hidden sm:flex"
// Mobile menu with Sheet
<Sheet>
  <SheetTrigger className="sm:hidden"><Menu /></SheetTrigger>
  <SheetContent side="left">{/* Nav móvil */}</SheetContent>
</Sheet>
```

### Tables

Use `ScrollTable` for data tables — gradient scroll indicators, single scroll zone.

```tsx
import { ScrollTable } from "@/components/ui/scroll-table";

// ✅ Preferred
<ScrollTable minWidth="640px">
  <Table>...</Table>
</ScrollTable>

// ❌ Avoid
<div className="overflow-x-auto">
  <Table>...</Table>
</div>
```

**SortableHead:** Always use `<span className="inline-flex ...">` inside `<th>`, never `<div>`.

```tsx
// ✅ Correct
<th><span className="inline-flex items-center gap-1 whitespace-nowrap">Fecha <ChevronUp /></span></th>

// ❌ Wrong — block element causes overflow
<th><div className="flex items-center gap-1">Fecha <ChevronUp /></div></th>
```

### Layout Gotchas

**`SidebarInset` must have `min-w-0 overflow-hidden`** to prevent overflow at zoom > 100%.

```tsx
<SidebarInset className="min-w-0 overflow-hidden">
  {children}
</SidebarInset>
```

### Padding

```tsx
className="p-4 sm:p-6"
className="px-4 sm:px-6"
```

## PR Checklist

- [ ] `'use client'` en páginas
- [ ] UI = shadcn/ui
- [ ] Textos usuario español, código inglés
- [ ] Interfaces tipadas, sin `any`
- [ ] FadeIn en secciones principales
- [ ] Responsive: filtros `w-full sm:w-XX`
- [ ] Responsive: botones `w-full sm:w-auto`
- [ ] Responsive: tablas en `ScrollTable`
- [ ] Responsive: números grandes con `tabular-nums truncate`
- [ ] `SortableHead` usa `<span>` (no `<div>`) dentro de `<th>`
- [ ] `SidebarInset` tiene `min-w-0 overflow-hidden`
- [ ] **Frontend-first**: ¿Se puede resolver en cache?

## Commands

```bash
# Add shadcn component
npx shadcn@latest add [component]

# Dev server
npm run dev

# Build (static export)
npm run build
```
