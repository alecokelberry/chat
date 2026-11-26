// HeaderTitle: the open chat's title, as the archived Chat (and Grok)
// shows it: a raised pill (popover, the tooltip's hairline and soft
// drops, a touch see-through) 40px tall at 14px, one line that truncates.
// The page's heading, not a control: Rename in the chat's … menu swaps it
// for HeaderTitleEdit, the same pill holding the field and its ✕ ✓.
import type * as React from "react"

import { cn } from "@/lib/utils"

const pill =
  "flex h-10 max-w-full min-w-0 items-center rounded-full bg-popover/94 px-3 text-sm font-normal text-popover-foreground shadow-tooltip"

function HeaderTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="header-title"
      dir="auto"
      className={cn(pill, className)}
      {...props}
    >
      <span className="truncate">{children}</span>
    </h1>
  )
}

/** The pill while the title is renamed: 320px wide (or the room there
 *  is), the field centered, its ✕ ✓ at the end. It takes taps back from
 *  the header, which lets them through to the page. */
function HeaderTitleEdit({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="header-title-edit"
      className={cn(
        pill,
        "pointer-events-auto w-80 gap-2 pe-2 [&>[data-slot=input]]:text-center",
        className
      )}
      {...props}
    />
  )
}

export { HeaderTitle, HeaderTitleEdit }
