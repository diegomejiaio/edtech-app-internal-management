"use client";

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Skeleton } from "./skeleton";
import { CountUp } from "@/components/motion/count-up";

// =============================================================================
// StatCard - Single stat display card
// =============================================================================

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  description?: string;
  isLoading?: boolean;
  valueClassName?: string;
  className?: string;
  /**
   * Visual layout. `"default"` keeps the label/icon header row used across
   * detail and listing pages. `"badge"` mirrors the CRM Métricas cards: a
   * tinted icon badge on top, then the value, label and hint.
   */
  variant?: "default" | "badge";
  /** Tone color for the icon (and its badge) in the `"badge"` variant. */
  iconClassName?: string;
}

/**
 * Stat card for displaying a single metric
 * @example
 * <StatCard
 *   label="Total empresas"
 *   value={stats.total}
 *   icon={Building2}
 *   isLoading={isLoading}
 * />
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  isLoading,
  valueClassName,
  className,
  variant = "default",
  iconClassName,
}: StatCardProps) {
  if (variant === "badge") {
    return (
      <div
        className={cn(
          "rounded-lg border bg-background p-3 shadow-sm",
          className,
        )}
      >
        {Icon && (
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground",
              iconClassName,
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
        {isLoading ? (
          <Skeleton className="mt-2 h-8 w-24" />
        ) : (
          <p
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums",
              valueClassName,
            )}
          >
            {typeof value === "number" ? <CountUp target={value} /> : value}
          </p>
        )}
        <p className="text-xs font-medium">{label}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-sm font-medium">
          {label}
        </CardDescription>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="pb-2">
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <CardTitle
            className={cn("text-2xl font-bold tabular-nums", valueClassName)}
          >
            {typeof value === "number" ? <CountUp target={value} /> : value}
          </CardTitle>
        )}
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// StatCardSkeleton - Loading skeleton for stat card
// =============================================================================

export function StatCardSkeleton({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "badge";
}) {
  if (variant === "badge") {
    return (
      <div
        className={cn(
          "rounded-lg border bg-background p-3 shadow-sm",
          className,
        )}
      >
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="mt-2 h-8 w-24" />
        <Skeleton className="mt-1 h-3 w-20" />
      </div>
    );
  }
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent className="pb-2">
        <Skeleton className="h-8 w-20" />
      </CardContent>
    </Card>
  );
}
