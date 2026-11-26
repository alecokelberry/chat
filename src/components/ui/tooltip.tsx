// Tooltip: ui-sdk's tooltip as a popover-colored chip: 8px corners, 12/16
// text, a hairline and soft drop, no arrow, 6px off its trigger. It opens
// after 400ms, then at once while another was just open, and fades and
// zooms from its trigger (popup-motion).
import type * as React from "react"
import {
  Tooltip as TooltipPrimitive,
  TooltipContent as TooltipContentPrimitive,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip"

import { cn } from "@/lib/utils"

function Tooltip({
  delay = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive>) {
  return <TooltipPrimitive delay={delay} {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  collisionPadding = 16,
  ...props
}: React.ComponentProps<typeof TooltipContentPrimitive>) {
  return (
    <TooltipContentPrimitive
      side={side}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "pointer-events-none inline-flex w-fit max-w-80 popup-motion items-center gap-1.5 overflow-hidden rounded-lg bg-popover px-2.5 py-1.5 text-xs text-wrap text-popover-foreground shadow-tooltip",
        className
      )}
      {...props}
    />
  )
}

export { Tooltip, TooltipTrigger, TooltipContent }
