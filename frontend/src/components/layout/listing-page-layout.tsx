"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// ListingPageLayout - Page layout with header, stats, filters, and content
// =============================================================================

interface ListingPageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Page header with title, description, and optional action button
 */
export function ListingPageHeader({
  title,
  description,
  action,
  className,
}: ListingPageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  );
}

// =============================================================================
// StatsRow - Grid of stat cards
// =============================================================================

interface StatsRowProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * Responsive grid container for StatCard components
 * @example
 * <StatsRow columns={4}>
 *   <StatCard ... />
 *   <StatCard ... />
 * </StatsRow>
 */
export function StatsRow({ children, columns = 4, className }: StatsRowProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}

// =============================================================================
// ListingPageLayout - Full page wrapper
// =============================================================================

interface ListingPageLayoutProps {
  /** Page header content (use ListingPageHeader) */
  header: React.ReactNode;
  /** Stats row content (use StatsRow with StatCards) */
  stats?: React.ReactNode;
  /** Filter bar content (use FilterBar) */
  filters?: React.ReactNode;
  /** Main content (table, grid, etc.) */
  children: React.ReactNode;
  className?: string;
}

/**
 * Listing page layout with header, stats, filters, and content sections
 *
 * @example
 * <ListingPageLayout
 *   header={
 *     <ListingPageHeader
 *       title="Empresas"
 *       description="Gestiona las empresas del sistema"
 *       action={<Button>Nueva empresa</Button>}
 *     />
 *   }
 *   stats={
 *     <StatsRow>
 *       <StatCard label="Total" value={100} />
 *     </StatsRow>
 *   }
 *   filters={
 *     <FilterBar>
 *       <SearchInput ... />
 *     </FilterBar>
 *   }
 * >
 *   <DataTable ... />
 * </ListingPageLayout>
 */
export function ListingPageLayout({
  header,
  stats,
  filters,
  children,
  className,
}: ListingPageLayoutProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {header}
      {stats}
      {filters}
      {children}
    </div>
  );
}
