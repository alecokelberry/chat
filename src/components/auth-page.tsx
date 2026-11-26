// The page around signing in and adding the first passkey: the app's name
// and one control, centered. Sticky and solid, since iOS Home Screen apps
// blur the top edge unless an opaque box covers it, and padded clear of the
// notch and home indicator. The app's mark sits above the name, and the
// light/dark switch at the top end, since nobody is signed in to reach the
// account menu's Theme.
import type { ReactNode } from "react"
import { ArrowUpIcon, KeyRoundIcon } from "lucide-react"

import { BrandMark } from "@/components/ui/brand-mark"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <main className="sticky top-0 flex min-h-dvh w-full items-center justify-center bg-background safe-area text-foreground">
      <header className="absolute inset-x-0 top-0 flex justify-end safe-area">
        <ThemeToggle />
      </header>
      <div className="w-full text-center sm:w-signin">
        <BrandMark className="mx-auto mb-4 size-8" />
        <h1 className="text-2xl font-medium sm:text-3xl">Chat</h1>
        <div className="mt-8 flex flex-col items-center gap-3">{children}</div>
      </div>
    </main>
  )
}

/** The passkey pill: a label, then the go circle. Pending while `onClick`
 *  runs (the passkey sheet is open). */
export function PasskeyButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => Promise<void>
}) {
  return (
    <Button variant="prompt" size="none" onClick={onClick}>
      <span className="flex items-center gap-3">
        <KeyRoundIcon className="text-muted-foreground" />
        {label}
      </span>
      <span data-slot="prompt-go" aria-hidden="true">
        <ArrowUpIcon />
      </span>
    </Button>
  )
}

export function AuthError({ message }: { message: string | null }) {
  return (
    <p role="alert" className="min-h-5 text-sm text-destructive-foreground">
      {message}
    </p>
  )
}
