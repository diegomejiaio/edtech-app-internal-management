"use client";

import * as React from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  fadeUpVariants,
  cardVariants,
  tableRowVariants,
} from "./variants";

// =============================================================================
// AnimatedList - Stagger container for list animations
// =============================================================================

interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between items in seconds. Default: 0.05 */
  staggerDelay?: number;
  /** Custom variants for the container */
  variants?: Variants;
}

/**
 * Animated container that staggers children animations
 *
 * @example
 * <AnimatedList>
 *   {items.map(item => (
 *     <AnimatedListItem key={item.id}>
 *       <Card>...</Card>
 *     </AnimatedListItem>
 *   ))}
 * </AnimatedList>
 */
export function AnimatedList({
  children,
  className,
  staggerDelay = 0.05,
  variants,
}: AnimatedListProps) {
  const containerVariants = variants ?? {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// AnimatedListItem - Single animated item in a list
// =============================================================================

interface AnimatedListItemProps {
  children: React.ReactNode;
  className?: string;
  /** Animation variant: 'fadeUp' | 'scale' | 'tableRow'. Default: 'fadeUp' */
  variant?: "fadeUp" | "scale" | "tableRow";
  /** Custom variants */
  variants?: Variants;
}

/**
 * Animated item that works with AnimatedList or standalone
 */
export function AnimatedListItem({
  children,
  className,
  variant = "fadeUp",
  variants,
}: AnimatedListItemProps) {
  const selectedVariants = variants ?? {
    fadeUp: fadeUpVariants,
    scale: cardVariants,
    tableRow: tableRowVariants,
  }[variant];

  return (
    <motion.div variants={selectedVariants} className={className}>
      {children}
    </motion.div>
  );
}

// =============================================================================
// AnimatedTableBody - For animating table rows
// =============================================================================

interface AnimatedTableBodyProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Animated table body container with staggered row animations
 *
 * @example
 * <Table>
 *   <TableHeader>...</TableHeader>
 *   <AnimatedTableBody>
 *     {rows.map(row => (
 *       <AnimatedTableRow key={row.id}>
 *         <TableCell>...</TableCell>
 *       </AnimatedTableRow>
 *     ))}
 *   </AnimatedTableBody>
 * </Table>
 */
export function AnimatedTableBody({
  children,
  className,
}: AnimatedTableBodyProps) {
  // No stagger orchestrator: each row animates independently on mount so
  // that rows added after the initial render (e.g. when a search filter is
  // cleared and the dataset grows) still play their entrance animation
  // instead of getting stuck at the parent's stale "hidden" state.
  //
  // AnimatePresence with initial={false} ensures the entrance flash only
  // plays for rows added after the first paint (create / filter widens /
  // pagination expands). Rows present on the initial render appear without
  // animation, so a fresh list doesn't strobe orange.
  return (
    <tbody className={className}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </tbody>
  );
}

// =============================================================================
// AnimatedTableRow - Single animated table row
// =============================================================================

interface AnimatedTableRowProps extends React.ComponentProps<typeof motion.tr> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Animated table row with fade+slide effect
 */
export function AnimatedTableRow({
  children,
  className,
  ...props
}: AnimatedTableRowProps) {
  return (
    <motion.tr
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={tableRowVariants}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    >
      {children}
    </motion.tr>
  );
}

// =============================================================================
// AnimatedCard - Card with entrance animation
// =============================================================================

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  /** Use as list item in AnimatedList (uses variants) or standalone (uses initial/animate) */
  asListItem?: boolean;
}

/**
 * Card wrapper with fade+scale entrance animation
 */
export function AnimatedCard({
  children,
  className,
  asListItem = false,
}: AnimatedCardProps) {
  if (asListItem) {
    return (
      <motion.div variants={cardVariants} className={className}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// AnimatedPresenceWrapper - For exit animations
// =============================================================================

interface AnimatedPresenceWrapperProps {
  children: React.ReactNode;
  /** Key for AnimatePresence tracking */
  presenceKey?: string;
  /** Mode: 'sync' | 'wait' | 'popLayout'. Default: 'sync' */
  mode?: "sync" | "wait" | "popLayout";
}

/**
 * Wrapper for AnimatePresence to handle exit animations
 */
export function AnimatedPresenceWrapper({
  children,
  presenceKey,
  mode = "sync",
}: AnimatedPresenceWrapperProps) {
  return (
    <AnimatePresence mode={mode}>
      {presenceKey ? (
        <motion.div key={presenceKey}>{children}</motion.div>
      ) : (
        children
      )}
    </AnimatePresence>
  );
}
