// Textarea: ui-sdk's textarea (form, submit shortcut, auto-resize) with the
// design system's look: bare text on whatever surface holds it, like the
// composer's, at 16px on touch screens so iOS never zooms on focus.
import type * as React from "react"
import { Textarea as TextareaPrimitive } from "@ui-sdk/react/textarea"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  ...props
}: React.ComponentProps<typeof TextareaPrimitive>) {
  return (
    <TextareaPrimitive
      className={cn(
        "max-h-60 min-h-10 w-full resize-none bg-transparent py-2 field-text text-foreground outline-hidden placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
