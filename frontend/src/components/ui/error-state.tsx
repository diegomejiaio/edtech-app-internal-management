"use client";

import * as React from "react";
import { AlertCircle, type LucideIcon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Shared animation — scale + fade from slightly below
const errorStateVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

// =============================================================================
// ErrorState - Consistent error state display with retry
// =============================================================================

interface ErrorStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  retryLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Error state component for API errors and failed operations
 * @example
 * <ErrorState
 *   title="Error al cargar datos"
 *   description="No se pudo conectar con el servidor."
 *   onRetry={() => refetch()}
 *   isRetrying={isRefetching}
 * />
 */
export function ErrorState({
  icon: Icon = AlertCircle,
  title = "Algo salió mal",
  description = "Ocurrió un error inesperado. Intenta de nuevo.",
  onRetry,
  isRetrying = false,
  retryLabel = "Reintentar",
  className,
  children,
}: ErrorStateProps) {
  return (
    <motion.div
      variants={errorStateVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 py-12 text-center",
        className,
      )}
    >
      <Icon className="h-12 w-12 text-destructive/70" />
      <h3 className="mt-4 text-lg font-medium text-destructive">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          className="mt-4"
          onClick={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reintentando...
            </>
          ) : (
            retryLabel
          )}
        </Button>
      )}
      {children}
    </motion.div>
  );
}
