// ScrollArea: ui-sdk's scroll area with the browser's own thin scrollbars
// (app.css). For the chat thread: `stickToEnd` keeps a streaming reply in
// view until you scroll up, and scrolling back down sticks again.
import type * as React from "react"
import {
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaContent,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  stickToEnd,
  fade,
  ...props
}: React.ComponentProps<typeof ScrollAreaViewport> & {
  stickToEnd?: boolean
  /** Fade the top and bottom edge while there's more to scroll that way. */
  fade?: boolean
}) {
  return (
    <ScrollAreaPrimitive
      stickToEnd={stickToEnd}
      className={cn("relative min-h-0", className)}
    >
      <ScrollAreaViewport
        className={cn(
          "size-full outline-hidden",
          fade === true && "scroll-fade-y"
        )}
        {...props}
      >
        <ScrollAreaContent>{children}</ScrollAreaContent>
      </ScrollAreaViewport>
    </ScrollAreaPrimitive>
  )
}

export { ScrollArea }
