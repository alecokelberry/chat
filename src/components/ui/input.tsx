// Input: ui-sdk's text field, bare: no box or ring, just text on whatever
// holds it (a chat row or the title pill being renamed), at 16px on touch
// screens so iOS never zooms on focus. The selection takes the pressed
// wash, so the selected title reads on the row's own wash.
import type * as React from "react"
import { Input as InputPrimitive } from "@ui-sdk/react/input"

import { cn } from "@/lib/utils"

function Input({
  className,
  ...props
}: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "h-6 w-full min-w-0 flex-1 bg-transparent field-text text-foreground outline-hidden selection:bg-secondary-active placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
