'use client';

/**
 * Generic data table for list views.
 *
 * Provides load-more controls, optional search, and a slot-based column
 * model. Designed for Espacio Pro's `PaginatedResponse<T>` envelope.
 * Supports animated row entrance via Framer Motion.
 *
 * Usage:
 *   <DataTable
 *     columns={columns}
 *     data={students}
 *     total={response.total}
 *     hasNextPage={hasNextPage}
 *     isFetchingNextPage={isFetchingNextPage}
 *     onLoadMore={fetchNextPage}
 *     isLoading={isLoading}
 *     animated={true}
 *   />
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedTableBody, AnimatedTableRow } from '@/components/motion/animated-list';
import { useEffect, useRef, type ReactNode } from 'react';

export interface Column<T> {
  /** Unique key for the column. */
  key: string;
  /** Column header label (Spanish — visible to user). */
  header: string;
  /** Render function for the cell content. */
  cell: (row: T) => ReactNode;
  /** Optional class for the cell. */
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Total count from the paginated response. */
  total: number;
  /** Whether more rows are available. */
  hasNextPage?: boolean;
  /** Called when the user requests more rows. */
  onLoadMore?: () => void;
  /** Unique key extractor for each row. */
  rowKey: (row: T) => string;
  /** Whether data is currently loading. */
  isLoading?: boolean;
  /** Whether the next batch is currently loading while rows remain visible. */
  isFetchingNextPage?: boolean;
  /** Automatically request more rows when the bottom sentinel enters the viewport. */
  autoLoadMore?: boolean;
  /** Number of skeleton rows to show while loading. */
  skeletonRows?: number;
  /** Text shown when the table has no rows. */
  emptyMessage?: string;
  /** Optional actions column rendered at the end of each row. */
  actions?: (row: T) => ReactNode;
  /** Enable stagger animations for data rows. Default: true */
  animated?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  total,
  hasNextPage,
  onLoadMore,
  rowKey,
  isLoading = false,
  isFetchingNextPage = false,
  autoLoadMore = false,
  skeletonRows = 5,
  emptyMessage = 'Sin resultados',
  actions,
  animated = true,
}: DataTableProps<T>) {
  const colCount = columns.length + (actions ? 1 : 0);
  const hasRows = data.length > 0;
  const hasMore = hasNextPage ?? data.length < total;
  const canLoadMore = hasMore && !isLoading && !isFetchingNextPage && !!onLoadMore;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedLoadRef = useRef(false);

  useEffect(() => {
    if (!autoLoadMore || !canLoadMore || !sentinelRef.current) return;

    const sentinel = sentinelRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !requestedLoadRef.current) {
          requestedLoadRef.current = true;
          onLoadMore?.();
        }
      },
      { rootMargin: '240px' },
    );

    observer.observe(sentinel);
    return () => observer.unobserve(sentinel);
  }, [autoLoadMore, canLoadMore, onLoadMore]);

  useEffect(() => {
    if (!isFetchingNextPage) {
      requestedLoadRef.current = false;
    }
  }, [isFetchingNextPage]);

  // Determine which body component to use
  const BodyComponent = animated && !isLoading ? AnimatedTableBody : TableBody;
  const RowComponent = animated && !isLoading ? AnimatedTableRow : TableRow;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
              {actions && <TableHead className="w-24 text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>

          {/* Loading state - always use regular components */}
          {isLoading && !hasRows && (
            <TableBody>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {Array.from({ length: colCount }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          )}

          {/* Empty state */}
          {!isLoading && !hasRows && (
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            </TableBody>
          )}

          {/* Data rows - use animated or regular components */}
          {hasRows && (
            <BodyComponent>
              {data.map((row) => (
                <RowComponent key={rowKey(row)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                  {actions && <TableCell className="text-right">{actions(row)}</TableCell>}
                </RowComponent>
              ))}
              {isFetchingNextPage && (
                <TableRow key="__fetch_next_skeleton__">
                  {Array.from({ length: colCount }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </BodyComponent>
          )}
        </Table>
      </div>

      {/* Load-more controls */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {Math.min(data.length, total)} de {total}
          </p>
          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              disabled={!canLoadMore}
              onClick={onLoadMore}
            >
              {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
            </Button>
          )}
        </div>
      )}
      {autoLoadMore && hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
    </div>
  );
}
