'use client'

import { useMemo } from 'react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

interface MonthRangeSliderProps {
  /** [fromMonth, toMonth] where 1=Ene, 12=Dic */
  value: [number, number]
  onChange: (range: [number, number]) => void
  className?: string
}

/**
 * Dual-thumb slider for selecting a month range within a year.
 * Full range [1–12] = "Acumulado". Single month = e.g. [3, 3].
 */
export function MonthRangeSlider({ value, onChange, className }: MonthRangeSliderProps) {
  const isFullYear = value[0] === 1 && value[1] === 12

  const rangeLabel = useMemo(() => {
    if (isFullYear) return '12 meses'
    if (value[0] === value[1]) return MONTH_LABELS[value[0] - 1]
    return `${MONTH_LABELS[value[0] - 1]} – ${MONTH_LABELS[value[1] - 1]}`
  }, [value, isFullYear])

  return (
    <div className={cn('w-full space-y-2', className)}>
      {/* Range label */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Período</span>
        <span className="text-sm font-semibold tabular-nums">{rangeLabel}</span>
      </div>

      {/* Slider */}
      <Slider
        min={1}
        max={12}
        step={1}
        value={value}
        onValueChange={(v) => onChange(v as [number, number])}
        className="w-full"
      />

      {/* Month tick labels */}
      <div className="flex justify-between px-0.5">
        {MONTH_LABELS.map((label, i) => {
          const month = i + 1
          const inRange = month >= value[0] && month <= value[1]
          return (
            <span
              key={label}
              className={cn(
                'text-[10px] tabular-nums transition-colors select-none',
                inRange ? 'text-foreground font-medium' : 'text-muted-foreground/50'
              )}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
