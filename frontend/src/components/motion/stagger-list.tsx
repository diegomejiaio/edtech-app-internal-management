"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface StaggerListProps {
  children: ReactNode[];
  delay?: number;
  staggerDelay?: number;
  /** Applied to the container div — use this to set grid/flex layout */
  className?: string;
  /** Applied to each item wrapper — use when items need specific grid behavior */
  itemClassName?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: (custom: { delay: number; staggerDelay: number }) => ({
    opacity: 1,
    transition: {
      delayChildren: custom.delay,
      staggerChildren: custom.staggerDelay,
    },
  }),
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.4, 0.25, 1] as const,
    },
  },
};

export function StaggerList({
  children,
  delay = 0,
  staggerDelay = 0.08,
  className = "",
  itemClassName = "",
}: StaggerListProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      custom={{ delay, staggerDelay }}
      className={className}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={itemVariants}
          className={itemClassName}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
