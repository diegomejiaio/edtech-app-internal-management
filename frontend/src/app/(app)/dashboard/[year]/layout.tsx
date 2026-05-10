/**
 * Dashboard year layout — generates static params for each year (2024–2030)
 * so that `output: 'export'` can pre-render all `/dashboard/[year]` pages.
 */

export function generateStaticParams() {
  return Array.from({ length: 7 }, (_, i) => ({
    year: String(2024 + i),
  }))
}

export default function DashboardYearLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
