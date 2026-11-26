// MessageToolbar: the row of icon actions under a reply. It is ui-sdk's
// Toolbar, so Tab enters it once and the arrow keys move between its
// buttons (MessageToolbarButton, drawn by rendering a Button through
// `render`); name it with aria-label. `reveal="hover"` keeps its space but
// shows it only while its message (a `group/message`) is hovered or holds
// focus. Touch screens have no hover, so there it always shows.
import type * as React from "react"
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar"

import { cn } from "@/lib/utils"

function MessageToolbar({
  className,
  reveal = "always",
  ...props
}: React.ComponentProps<typeof Toolbar> & { reveal?: "always" | "hover" }) {
  return (
    <Toolbar
      data-slot="message-toolbar"
      data-reveal={reveal}
      className={cn(
        "-ms-0.5 flex items-center gap-0.5 data-[reveal=hover]:opacity-0 data-[reveal=hover]:transition-opacity data-[reveal=hover]:duration-base data-[reveal=hover]:group-hover/message:opacity-100 data-[reveal=hover]:focus-within:opacity-100 motion-reduce:transition-none data-[reveal=hover]:pointer-coarse:opacity-100",
        className
      )}
      {...props}
    />
  )
}

const MessageToolbarButton = ToolbarButton

export { MessageToolbar, MessageToolbarButton }
