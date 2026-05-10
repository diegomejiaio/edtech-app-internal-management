'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const PRESET_COLORS = [
  { value: '#2563eb', label: 'Azul' },
  { value: '#059669', label: 'Verde' },
  { value: '#7c3aed', label: 'Morado' },
  { value: '#d97706', label: 'Naranja' },
  { value: '#dc2626', label: 'Rojo' },
  { value: '#6b7280', label: 'Gris' },
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start"
          disabled={disabled}
        >
          <div
            className="mr-2 h-4 w-4 rounded border"
            style={{ backgroundColor: value }}
          />
          <span>{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                className={cn(
                  'h-8 w-8 rounded-md border-2 transition-all',
                  value === color.value ? 'border-primary' : 'border-transparent'
                )}
                style={{ backgroundColor: color.value }}
                onClick={() => {
                  onChange(color.value)
                  setOpen(false)
                }}
                title={color.label}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="font-mono"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
