// Toggle: ui-sdk's toggle button (Enter and Space, aria-pressed), drawn as
// Grok's header pill: a 32px ghost pill, an 18px glyph then its words,
// muted until pressed, when it fills with the quiet wash in full ink, as
// Grok's Private does. Its name stays the same pressed or not, as ui-sdk
// asks, so a screen reader announces the state instead.
import type * as React from "react"
import { Toggle as TogglePrimitive } from "@ui-sdk/react/toggle"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Toggle({
  className,
  ...props
}: React.ComponentProps<typeof TogglePrimitive>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "gap-1.5 px-3 text-base font-normal data-pressed:bg-secondary data-pressed:text-foreground data-pressed:hover:bg-secondary-hover [&_svg:not([class*='size-'])]:size-4.5",
        className
      )}
      {...props}
    />
  )
}

export { Toggle }
