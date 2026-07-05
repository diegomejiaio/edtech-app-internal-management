'use client';

import { Badge } from '@/components/ui/badge';
import type { StatusBadgeVariant } from '@/lib/status';
import { cn } from '@/lib/utils';

interface StatusBadgeProps<T extends string> {
  value: T;
  labels: Record<T, string>;
  variants: Record<T, StatusBadgeVariant>;
  className?: string;
}

export function StatusBadge<T extends string>({
  value,
  labels,
  variants,
  className,
}: StatusBadgeProps<T>) {
  return (
    <Badge variant={variants[value] ?? 'outline'} className={cn(className)}>
      {labels[value] ?? value}
    </Badge>
  );
}
