"use client";

import * as React from "react";
import { FileText, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Shared animation — scale + fade from slightly below
const emptyStateVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

// =============================================================================
// EmptyState - Consistent empty state display
// =============================================================================

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  filterDescription?: string;
  hasFilters?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: React.ReactNode;
}

/**
 * Empty state component for tables and lists
 * @example
 * <EmptyState
 *   icon={Building2}
 *   title="No hay empresas"
 *   description="Las empresas aparecerán aquí."
 *   hasFilters={!!searchQuery}
 *   action={{ label: 'Crear empresa', onClick: () => setOpen(true) }}
 * />
 */
export function EmptyState({
  icon: Icon = FileText,
  title,
  description,
  filterDescription = "Intenta ajustar los filtros de búsqueda.",
  hasFilters = false,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <motion.div
      variants={emptyStateVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center",
        className,
      )}
    >
      <Icon className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasFilters ? filterDescription : description}
      </p>
      {action && !hasFilters && (
        <Button className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </motion.div>
  );
}

// =============================================================================
// ErrorState - Error state with retry action
// =============================================================================

interface ErrorStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Error state component with optional retry
 * @example
 * <ErrorState onRetry={() => refetch()} />
 */
export function ErrorState({
  icon: Icon = FileText,
  title = "Error al cargar datos",
  description = "No pudimos cargar los datos. Intenta de nuevo.",
  onRetry,
  retryLabel = "Reintentar",
  className,
}: ErrorStateProps) {
  return (
    <motion.div
      variants={emptyStateVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center",
        className,
      )}
    >
      <Icon className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </motion.div>
  );
}
