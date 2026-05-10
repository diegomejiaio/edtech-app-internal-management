'use client'

import { motion } from 'framer-motion'

interface AnimatedProgressProps {
  progress: number
  delay?: number
  duration?: number
  className?: string
}

export function AnimatedProgress({ 
  progress, 
  delay = 0, 
  duration = 2,
  className = '',
}: AnimatedProgressProps) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-muted/50 ${className}`}>
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ 
          delay, 
          duration,
          ease: [0.25, 0.4, 0.25, 1],
        }}
      />
    </div>
  )
}
