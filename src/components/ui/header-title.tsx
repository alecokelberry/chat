// HeaderTitle: the open chat's title, as the archived Chat (and Grok)
// shows it: a raised pill (popover, the tooltip's hairline and soft
// drops, a touch see-through) 40px tall at 14px, one line that truncates.
// The page's heading, not a control: renaming will live in the chat's
// menu.
import type * as React from "react"

import { cn } from "@/lib/utils"

function HeaderTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="header-title"
      dir="auto"
      className={cn(
        "flex h-10 max-w-full min-w-0 items-center rounded-full bg-popover/94 px-3 text-sm font-normal text-popover-foreground shadow-tooltip",
        className
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
    </h1>
  )
}

export { HeaderTitle }
