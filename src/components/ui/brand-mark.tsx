// The app's mark: lucide's round speech bubble, the same glyph as the
// favicon and Home Screen icon (public/icon.svg). Decorative (the name sits
// beside it), so it's hidden from screen readers; the caller sizes it with `size-*`.
import { MessageCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function BrandMark({ className }: { className?: string }) {
  return (
    <MessageCircleIcon
      aria-hidden
      className={cn("shrink-0 text-foreground", className)}
    />
  )
}

export { BrandMark }
