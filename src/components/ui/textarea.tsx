// Textarea: ui-sdk's textarea (form, submit shortcut, auto-resize) with the
// design system's look: bare text on whatever surface holds it, at 16px on
// touch screens so iOS never zooms on focus. The composer's (`default`):
// one line is 32px (a 24px line, 4px above and below) beside its 32px
// Send; it grows to 400px, then scrolls. `inline` edits text in place, as
// a question in its bubble: no padding of its own, so the text stays where
// it was, growing to 320px.
import type * as React from "react"
import { Textarea as TextareaPrimitive } from "@ui-sdk/react/textarea"

import { cn } from "@/lib/utils"

const variants = {
  default: "max-h-100 min-h-8 px-2 py-1",
  inline: "block max-h-80 min-h-6",
}

function Textarea({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TextareaPrimitive> & {
  variant?: keyof typeof variants
}) {
  return (
    <TextareaPrimitive
      className={cn(
        "w-full resize-none bg-transparent field-text text-foreground outline-hidden placeholder:text-muted-foreground",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
