"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onValueChange"> {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = [parseInt(event.target.value, 10)]
      onValueChange?.(newValue)
    }

    const val = value?.[0] ?? 0
    const percentage = ((val - min) / (max - min)) * 100

    return (
      <div className={cn("relative flex w-full touch-none select-none items-center py-4", className)}>
        <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-100">
          <div 
            className="absolute h-full bg-indigo-600 transition-all" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={val}
          onChange={handleChange}
          className="absolute h-2 w-full cursor-pointer appearance-none bg-transparent opacity-0 z-10"
          ref={ref}
          {...props}
        />
        {/* Visual Thumb */}
        <div 
          className="absolute h-5 w-5 rounded-full border-2 border-indigo-600 bg-white shadow-sm transition-all pointer-events-none"
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
