'use client';

/**
 * Page header with title, optional description, and action slot.
 *
 * Used at the top of every CRUD list page for consistency.
 *
 * Usage:
 *   <PageHeader
 *     title="Alumnos"
 *     description="Listado de alumnos registrados"
 *     action={<Button>Nuevo alumno</Button>}
 *   />
 */

import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
