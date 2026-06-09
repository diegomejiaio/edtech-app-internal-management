'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useModKey, useKeyboardShortcut } from '@/hooks';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Page header with title, optional subtitle, back navigation and action slot.
 *
 * Matches the CRUD list header used by pages such as Alumnos.
 *
 * @example
 * <PageHeader title="Dashboard" subtitle="Resumen de la actividad de hoy">
 *   <PageHeaderButton icon={Plus} onClick={handleCreate} shortcutKey="n">
 *     Nuevo Alumno
 *   </PageHeaderButton>
 * </PageHeader>
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {backHref && (
          <Link href={backHref}>
            <Button variant="ghost" size="icon" aria-label="Volver" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="mt-2 flex items-center gap-2 sm:mt-0">{children}</div>
      )}
    </div>
  );
}

interface PageHeaderButtonProps {
  icon?: LucideIcon;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'secondary';
  shortcutKey?: string;
  showShortcutTooltip?: boolean;
  className?: string;
}

/**
 * Primary action button for page headers with optional keyboard shortcut.
 */
export function PageHeaderButton({
  icon,
  children,
  onClick,
  variant = 'default',
  shortcutKey,
  showShortcutTooltip = true,
  className,
}: PageHeaderButtonProps) {
  const modKey = useModKey();

  useKeyboardShortcut(shortcutKey || '', () => onClick?.(), {
    enabled: !!shortcutKey && !!onClick,
  });

  const button = (
    <Button
      onClick={onClick}
      variant={variant}
      className={cn(
        'gap-2',
        variant === 'default' &&
          'bg-primary hover:bg-primary/90 text-primary-foreground',
        className,
      )}
    >
      {icon && React.createElement(icon, { className: 'h-5 w-5' })}
      {children}
    </Button>
  );

  if (shortcutKey && showShortcutTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <span className="flex items-center gap-2">
            {children}
            <KbdGroup>
              <Kbd>{modKey}</Kbd>
              <Kbd className="uppercase">{shortcutKey}</Kbd>
            </KbdGroup>
          </span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
