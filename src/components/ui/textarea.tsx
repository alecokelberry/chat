// Textarea: ui-sdk's textarea (form, submit shortcut, auto-resize) with the
// design system's look: bare text on whatever surface holds it, like the
// composer's, at 16px on touch screens so iOS never zooms on focus. One
// line is 32px (a 24px line, 4px above and below) beside the composer's
// 32px Send; it grows to 400px, then scrolls.
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
        "max-h-100 min-h-8 w-full resize-none bg-transparent px-2 py-1 field-text text-foreground outline-hidden placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
