'use client'

import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type ReactNode } from 'react'

interface ScaleInProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit'> {
  children: ReactNode
  show?: boolean
  duration?: number
}

export const ScaleIn = forwardRef<HTMLDivElement, ScaleInProps>(
  ({ children, show = true, duration = 0.2, ...props }, ref) => (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration, ease: [0.25, 0.4, 0.25, 1] }}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
)

ScaleIn.displayName = 'ScaleIn'
