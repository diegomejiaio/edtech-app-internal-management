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
}: StatCardProps) {
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

export function StatCardSkeleton({ className }: { className?: string }) {
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
