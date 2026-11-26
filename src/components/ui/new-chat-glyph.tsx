// New Chat's glyph, after Grok's filled plus-circle (blue there, `send`
// pink here): a solid circle with a plus cut in the send button's ink. The
// row sizes it (20px in New Chat).
import type * as React from "react"

import { cn } from "@/lib/utils"

function NewChatGlyph({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      data-slot="new-chat-glyph"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("text-send", className)}
      {...props}
    >
      <circle cx="12" cy="12" r="12" fill="currentColor" />
      <path
        d="M12 7v10M7 12h10"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
    </svg>
  )
}

export { NewChatGlyph }
