"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./sheet";
import { ScrollArea } from "./scroll-area";
import { Badge } from "./badge";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "./badge";

// =============================================================================
// FormSheet - Sheet wrapper for form editing patterns
// =============================================================================

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Sheet width. Default: w-full sm:w-120 sm:max-w-lg */
  width?: string;
  className?: string;
}

/**
 * Sheet wrapper optimized for form editing
 *
 * @example
 * <FormSheet open={open} onOpenChange={setOpen}>
 *   <FormSheetHeader
 *     title="Editar estudiante"
 *     badge={{ variant: "success", children: "Activo" }}
 *   />
 *   <FormSheetContent>
 *     <Form ... />
 *   </FormSheetContent>
 *   <FormSheetFooter>
 *     <Button variant="outline">Cancelar</Button>
 *     <Button>Guardar</Button>
 *   </FormSheetFooter>
 * </FormSheet>
 */
export function FormSheet({
  open,
  onOpenChange,
  children,
  width = "w-full sm:w-[30rem] sm:max-w-lg",
  className,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("p-0 flex flex-col", width, className)}>
        {children}
      </SheetContent>
    </Sheet>
  );
}

// =============================================================================
// FormSheetHeader - Header with title, optional badge, and description
// =============================================================================

interface FormSheetHeaderProps {
  title: string;
  description?: string;
  badge?: {
    variant?: VariantProps<typeof badgeVariants>["variant"];
    children: React.ReactNode;
  };
  className?: string;
}

/**
 * Form sheet header with title, optional badge, and description
 * Has border-bottom and doesn't scroll
 */
export function FormSheetHeader({
  title,
  description,
  badge,
  className,
}: FormSheetHeaderProps) {
  return (
    <SheetHeader
      className={cn(
        "px-6 pt-6 pb-4 border-b shrink-0 pr-12 space-y-0",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <SheetTitle>{title}</SheetTitle>
        {badge && <Badge variant={badge.variant}>{badge.children}</Badge>}
      </div>
      {description && <SheetDescription>{description}</SheetDescription>}
    </SheetHeader>
  );
}

// =============================================================================
// FormSheetContent - Scrollable content area
// =============================================================================

interface FormSheetContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Scrollable content area for form fields
 */
export function FormSheetContent({
  children,
  className,
}: FormSheetContentProps) {
  return (
    <ScrollArea className="flex-1">
      <div className={cn("px-6 py-4", className)}>{children}</div>
    </ScrollArea>
  );
}

// =============================================================================
// FormSheetFooter - Sticky footer with action buttons
// =============================================================================

interface FormSheetFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Sticky footer for action buttons (Cancel, Save, etc.)
 */
export function FormSheetFooter({
  children,
  className,
}: FormSheetFooterProps) {
  return (
    <SheetFooter
      className={cn(
        "px-6 py-4 border-t shrink-0 flex-row gap-2 sm:justify-end",
        className
      )}
    >
      {children}
    </SheetFooter>
  );
}
