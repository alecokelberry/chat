// The app's mark: lucide's round speech bubble, the same glyph as the
// favicon and Home Screen icon (public/icon.svg). Decorative (the name sits
// beside it), so it's hidden from screen readers; the caller sizes it with
// `size-*`. Alone (the sign-in page) it's in full ink; among the sidebar's
// icons (`tone="icon"`) it takes their gray, so it doesn't outshine them.
import { MessageCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function BrandMark({
  className,
  tone = "ink",
}: {
  className?: string
  tone?: "ink" | "icon"
}) {
  return (
    <MessageCircleIcon
      aria-hidden
      className={cn(
        "shrink-0",
        tone === "icon" ? "text-sidebar-icon" : "text-foreground",
        className
      )}
    />
  )
}

export { BrandMark }
