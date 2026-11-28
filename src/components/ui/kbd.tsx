// Kbd: a keycap, Grok's: a 20px square chip (wider for a word like Ctrl
// or Tab) with 4px corners, 12px muted text on a faint tint of the
// surface it sits on. KbdShortcut shows a hint ui-sdk formatted for the
// platform ("⌘K", "Ctrl+K") as one keycap per key, 4px apart, and
// KbdKeys does the same for keys like "mod+j" (ui-sdk's useShortcutHint,
// which matches the server's render, then the platform). ui-sdk has
// no keycap part, so this is the shadcn-style <kbd>; the hint's text and
// the trigger's aria-keyshortcuts stay ui-sdk's.
import type * as React from "react"
import { useShortcutHint } from "@ui-sdk/react/shortcuts"

import { shortcutKeys } from "@/components/ui/shortcut-keys"
import { cn } from "@/lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-secondary px-1 font-sans text-xs text-muted-foreground select-none",
        className
      )}
      {...props}
    />
  )
}

/** One keycap per key of `hint`, as ui-sdk's useShortcutHint or
 *  TooltipShortcut formats it, hidden on touch-only devices. Hidden from screen readers: the control's
 *  aria-keyshortcuts says it instead. */
function KbdShortcut({
  hint,
  className,
}: {
  hint: string
  className?: string
}) {
  return (
    <span
      data-slot="kbd-group"
      aria-hidden
      className={cn(
        // No keycaps where no keyboard is likely: a phone has only touch.
        "inline-flex shrink-0 items-center gap-1 [@media(not_(any-pointer:fine))]:hidden",
        className
      )}
    >
      {/* A shortcut never names a key twice. */}
      {shortcutKeys(hint).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  )
}

/** `shortcut`'s keys, like "mod+j", as keycaps for this platform. */
function KbdKeys({
  shortcut,
  className,
}: {
  shortcut: string
  className?: string
}) {
  return (
    <KbdShortcut hint={useShortcutHint(shortcut).text} className={className} />
  )
}

export { Kbd, KbdKeys, KbdShortcut }
