'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Skeleton } from './skeleton'
import { InlineSpinner } from './loading'

// =============================================================================
// TableFooter - Footer with count info and "load more" button
// =============================================================================

interface TableFooterProps {
  currentCount: number
  totalCount?: number
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  isFiltered?: boolean
  onLoadMore?: () => void
  entityName?: string
  className?: string
}

/**
 * Table footer with item count and pagination
 * @example
 * <TableFooter
 *   currentCount={items.length}
 *   totalCount={data?.total_count}
 *   hasNextPage={hasNextPage}
 *   isFetchingNextPage={isFetchingNextPage}
 *   isFiltered={!!searchQuery}
 *   onLoadMore={() => fetchNextPage()}
 *   entityName="empresas"
 * />
 */
export function TableFooter({
  currentCount,
  totalCount,
  hasNextPage,
  isFetchingNextPage,
  isFiltered,
  onLoadMore,
  entityName = 'elementos',
  className,
}: TableFooterProps) {
  const statusText = React.useMemo(() => {
    if (currentCount === 0) return 'Sin resultados'
    
    if (isFiltered) {
      return `${currentCount} resultado${currentCount !== 1 ? 's' : ''} de búsqueda`
    }
    
    const totalText = totalCount ? ` de ${totalCount.toLocaleString('es-PE')}` : ''
    const moreText = hasNextPage ? ' (hay más)' : ''
    return `Mostrando ${currentCount}${totalText} ${entityName}${moreText}`
  }, [currentCount, totalCount, hasNextPage, isFiltered, entityName])

  return (
    <div className={cn('flex items-center justify-between border-t px-4 py-3', className)}>
      <div className="text-sm text-muted-foreground">{statusText}</div>
      {hasNextPage && !isFiltered && onLoadMore && (
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? (
            <>
              <InlineSpinner className="mr-2" />
              Cargando...
            </>
          ) : (
            'Ver más'
          )}
        </Button>
      )}
    </div>
  )
}

// =============================================================================
// TableSkeleton - Loading skeleton for table rows
// =============================================================================

interface TableSkeletonColumn {
  width: string // e.g., 'w-32', 'w-20', 'flex-1'
  height?: string // e.g., 'h-4', 'h-6', defaults to 'h-4'
}

interface TableSkeletonProps {
  rows?: number
  columns: TableSkeletonColumn[]
  className?: string
}

/**
 * Loading skeleton for table content
 * @example
 * <TableSkeleton
 *   rows={5}
 *   columns={[
 *     { width: 'w-40' },
 *     { width: 'w-24' },
 *     { width: 'w-16', height: 'h-6' },
 *   ]}
 * />
 */
export function TableSkeleton({ rows = 5, columns, className }: TableSkeletonProps) {
  return (
    <div className={cn('space-y-3 py-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4">
          {columns.map((col, j) => (
            <Skeleton key={j} className={cn(col.height ?? 'h-4', col.width)} />
          ))}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// TableRowSkeleton - Single row skeleton
// =============================================================================

interface TableRowSkeletonProps {
  columns: TableSkeletonColumn[]
  className?: string
}

export function TableRowSkeleton({ columns, className }: TableRowSkeletonProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      {columns.map((col, i) => (
        <Skeleton key={i} className={cn(col.height ?? 'h-4', col.width)} />
      ))}
    </div>
  )
}
