// Spinner: Grok's ring of eight dots fading from full ink, turning one dot
// at a time (spin-steps in app.css). Reduced motion holds it still. It's
// decoration: whatever shows it says what's happening in words.
import type * as React from "react"

import { cn } from "@/lib/utils"

const DOTS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * 2 * Math.PI
  return {
    cx: 8 + 6 * Math.sin(angle),
    cy: 8 - 6 * Math.cos(angle),
    opacity: 1 - i * 0.11,
  }
})

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("size-4 shrink-0 spin-steps", className)}
      {...props}
    >
      {DOTS.map((dot) => (
        <circle
          key={`${dot.cx}-${dot.cy}`}
          cx={dot.cx}
          cy={dot.cy}
          r={1.25}
          opacity={dot.opacity}
        />
      ))}
    </svg>
  )
}

export { Spinner }
