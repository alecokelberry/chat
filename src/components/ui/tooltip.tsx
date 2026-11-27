// Tooltip: ui-sdk's tooltip as Grok's popover-colored chip: 12px corners,
// 14/20 text 12px in from each side, a hairline and soft drop, no arrow,
// 6px off its trigger, 32px tall with or without keycaps. It opens after
// 400ms, then at once while another was just open, and fades and zooms
// from its trigger (popup-motion). TooltipShortcut shows the tooltip's
// `shortcut` as Grok's keycaps ("Search ⌘ K"), 16px after the label: ui-sdk
// formats the keys for the platform, ⌘ on a Mac and Ctrl elsewhere, and
// gives the trigger aria-keyshortcuts; the keycaps are ui/kbd.tsx's.
import type * as React from "react"
import {
  Tooltip as TooltipPrimitive,
  TooltipContent as TooltipContentPrimitive,
  TooltipShortcut as TooltipShortcutPrimitive,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip"

import { KbdShortcut } from "@/components/ui/kbd"
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
        "pointer-events-none inline-flex w-fit max-w-80 popup-motion items-center gap-1.5 overflow-hidden rounded-xl bg-popover px-3 py-1.5 text-sm text-wrap text-popover-foreground shadow-tooltip",
        className
      )}
      {...props}
    />
  )
}

function TooltipShortcut({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TooltipShortcutPrimitive>, "children">) {
  return (
    <TooltipShortcutPrimitive
      className={cn("ms-2.5 inline-flex", className)}
      {...props}
    >
      {({ text }) => <KbdShortcut hint={text} />}
    </TooltipShortcutPrimitive>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipShortcut }
