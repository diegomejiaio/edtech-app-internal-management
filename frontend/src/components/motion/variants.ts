/**
 * Centralized motion variants for Framer Motion.
 *
 * Import these variants to maintain consistent animations across the app.
 * All durations use the standard easing curve for a polished feel.
 */

import type { Variants, Transition } from 'framer-motion';

// =============================================================================
// Shared Easing & Transitions
// =============================================================================

/** Standard easing curve — smooth deceleration */
export const EASE_DEFAULT = [0.25, 0.4, 0.25, 1] as const;

/** Snappy easing for quick interactions */
export const EASE_SNAPPY = [0.4, 0, 0.2, 1] as const;

/** Standard transition config */
export const transitionDefault: Transition = {
  duration: 0.3,
  ease: EASE_DEFAULT,
};

/** Fast transition for micro-interactions */
export const transitionFast: Transition = {
  duration: 0.15,
  ease: EASE_SNAPPY,
};

// =============================================================================
// Fade Variants
// =============================================================================

/** Simple opacity fade */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitionDefault,
  },
  exit: { opacity: 0, transition: transitionFast },
};

/** Fade with upward slide */
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionDefault,
  },
  exit: { opacity: 0, y: -8, transition: transitionFast },
};

/** Fade with downward slide */
export const fadeDownVariants: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionDefault,
  },
};

// =============================================================================
// Scale Variants
// =============================================================================

/** Scale in from slightly smaller */
export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: EASE_DEFAULT },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitionFast,
  },
};

/** Scale + fade + slight y offset — for empty states, cards */
export const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitionDefault,
  },
};

// =============================================================================
// List & Stagger Variants
// =============================================================================

/** Container for staggered children */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0,
    },
  },
};

/** Individual item in a staggered list */
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: EASE_DEFAULT,
    },
  },
};

/** Table row animation — entrance flashes primary tint, exit flashes destructive tint.
 *
 * NOTE: backgroundColor uses static start (orange) → end (transparent) values
 * rather than a keyframe array, because framer-motion always animates keyframe
 * arrays — even when AnimatePresence's `initial={false}` suppresses the variant
 * transition. With static values, the row mounts directly in the transparent
 * `visible` state on initial paint (no flash), and only animates orange→transparent
 * when entering from `hidden` (i.e. when AnimatePresence detects a new key). */
export const tableRowVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -12,
    backgroundColor: 'rgba(249, 115, 22, 0.32)',
  },
  visible: {
    opacity: 1,
    x: 0,
    backgroundColor: 'rgba(249, 115, 22, 0)',
    transition: {
      duration: 0.35,
      ease: EASE_DEFAULT,
      backgroundColor: { duration: 1.4, ease: 'easeOut' },
    },
  },
  exit: {
    opacity: 0,
    x: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.32)',
    transition: {
      duration: 0.28,
      ease: EASE_SNAPPY,
    },
  },
};

// =============================================================================
// Sheet & Dialog Variants
// =============================================================================

/** Sheet sliding in from right */
export const sheetRightVariants: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: EASE_DEFAULT },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.2, ease: EASE_SNAPPY },
  },
};

/** Dialog/modal center scale */
export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitionDefault,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitionFast,
  },
};

/** Overlay backdrop */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// =============================================================================
// Badge & Status Variants
// =============================================================================

/** Badge pop-in animation */
export const badgeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: EASE_SNAPPY },
  },
};

// =============================================================================
// Utility: Custom delay wrapper
// =============================================================================

/**
 * Creates a delayed version of any variant.
 *
 * @example
 * const delayedFade = withDelay(fadeUpVariants, 0.2);
 */
export function withDelay(variants: Variants, delay: number): Variants {
  return {
    ...variants,
    visible: {
      ...(variants.visible as object),
      transition: {
        ...((variants.visible as { transition?: Transition })?.transition ?? {}),
        delay,
      },
    },
  };
}

/**
 * Creates a stagger container with custom timing.
 *
 * @example
 * const slowStagger = createStaggerContainer(0.1, 0.2);
 */
export function createStaggerContainer(
  staggerChildren = 0.05,
  delayChildren = 0,
): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  };
}
