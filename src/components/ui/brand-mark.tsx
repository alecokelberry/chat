// The app's mark: lucide's speech bubble, as in the first Chat. Decorative
// (the name sits beside it), so it's hidden from screen readers; the
// caller sizes it with `size-*`.
import { MessageSquareIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function BrandMark({ className }: { className?: string }) {
  return (
    <MessageSquareIcon
      aria-hidden
      className={cn("shrink-0 text-foreground", className)}
    />
  )
}

export { BrandMark }
