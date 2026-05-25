'use client';

/**
 * Page header with title, optional description, back navigation, and action slot.
 *
 * Used at the top of every CRUD list page for consistency.
 *
 * Usage:
 *   <PageHeader
 *     title="Alumnos"
 *     description="Listado de alumnos registrados"
 *     backHref="/catalogs"
 *     action={<Button>Nuevo alumno</Button>}
 *   />
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, backHref, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link href={backHref}>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  );
}
