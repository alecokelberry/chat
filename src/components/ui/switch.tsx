// Switch: ui-sdk's switch, for a setting that takes effect as it changes
// (Settings' rows). A 36×22 pill: the pressed wash while off, ink while
// on; its 18px thumb (the ink's own text color) slides to the end over
// duration-fast, and back under right-to-left. Under reduced motion it
// jumps. A 40px invisible touch area on touch screens.
import type * as React from "react"
import {
  Switch as SwitchPrimitive,
  SwitchThumb as SwitchThumbPrimitive,
} from "@ui-sdk/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive>) {
  return (
    <SwitchPrimitive
      data-slot="switch"
      className={cn(
        "relative inline-flex h-5.5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-secondary-active p-0.5 outline-hidden transition-colors duration-fast ease-standard after:absolute after:-inset-1 focus-visible:ring-2 focus-visible:ring-ring data-checked:bg-primary pointer-coarse:after:-inset-2.5",
        className
      )}
      {...props}
    >
      <SwitchThumbPrimitive className="block size-4.5 rounded-full bg-primary-foreground shadow-tooltip transition-transform duration-fast ease-standard data-checked:translate-x-3.5 motion-reduce:transition-none rtl:data-checked:-translate-x-3.5" />
    </SwitchPrimitive>
  )
}

export { Switch }
