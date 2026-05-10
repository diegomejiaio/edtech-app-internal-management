'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type ReactNode } from 'react'

interface HoverLiftProps extends Omit<HTMLMotionProps<'div'>, 'whileHover' | 'whileTap'> {
  children: ReactNode
  lift?: number
  scale?: number
}

export const HoverLift = forwardRef<HTMLDivElement, HoverLiftProps>(
  ({ children, lift = -4, scale = 1.02, ...props }, ref) => (
    <motion.div
      ref={ref}
      whileHover={{ y: lift, scale, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      {...props}
    >
      {children}
    </motion.div>
  )
)

HoverLift.displayName = 'HoverLift'
