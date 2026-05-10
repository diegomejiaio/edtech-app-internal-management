'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface TypewriterProps {
  text: string
  delay?: number
  speed?: number
  className?: string
  onComplete?: () => void
  cursor?: boolean
}

export function Typewriter({ 
  text, 
  delay = 0, 
  speed = 50, 
  className = '',
  onComplete,
  cursor = true,
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showCursor, setShowCursor] = useState(cursor)

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setIsTyping(true)
      let currentIndex = 0
      
      const typeInterval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1))
          currentIndex++
        } else {
          clearInterval(typeInterval)
          setIsTyping(false)
          onComplete?.()
        }
      }, speed)

      return () => clearInterval(typeInterval)
    }, delay * 1000)

    return () => clearTimeout(startTimer)
  }, [text, delay, speed, onComplete])

  return (
    <span className={className}>
      {displayedText}
      {showCursor && (
        <motion.span
          animate={{ opacity: isTyping ? 1 : [1, 0] }}
          transition={{ 
            duration: 0.5, 
            repeat: isTyping ? 0 : Infinity, 
            repeatType: 'reverse' 
          }}
          className="inline-block w-0.5 h-[1em] bg-current ml-0.5 align-middle"
        />
      )}
    </span>
  )
}
