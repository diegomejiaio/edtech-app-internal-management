'use client';

/**
 * Generic data table for list views.
 *
 * Provides pagination controls, optional search, and a slot-based column
 * model. Designed for Espacio Pro's `PaginatedResponse<T>` envelope.
 *
 * Usage:
 *   <DataTable
 *     columns={columns}
 *     data={students}
 *     total={response.total}
 *     limit={limit}
 *     offset={offset}
 *     onPageChange={setOffset}
 *     isLoading={isLoading}
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
import type { ReactNode } from 'react';

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
  /** Current page size. */
  limit: number;
  /** Current offset. */
  offset: number;
  /** Called when the user navigates to a different page. */
  onPageChange: (newOffset: number) => void;
  /** Unique key extractor for each row. */
  rowKey: (row: T) => string;
  /** Whether data is currently loading. */
  isLoading?: boolean;
  /** Number of skeleton rows to show while loading. */
  skeletonRows?: number;
  /** Text shown when the table has no rows. */
  emptyMessage?: string;
  /** Optional actions column rendered at the end of each row. */
  actions?: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  total,
  limit,
  offset,
  onPageChange,
  rowKey,
  isLoading = false,
  skeletonRows = 5,
  emptyMessage = 'Sin resultados',
  actions,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const colCount = columns.length + (actions ? 1 : 0);

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
              {actions && <TableHead className="w-20">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {Array.from({ length: colCount }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              data.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                  {actions && <TableCell>{actions(row)}</TableCell>}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + limit, total)} de {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(0, offset - limit))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(offset + limit)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
