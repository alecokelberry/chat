// The pages for a thrown error and for an address that isn't there: the
// archived Chat's 404 look, a title, a line, and buttons, centered in
// whatever room the page has (the shell's column when signed in, the whole
// window otherwise). TanStack Router renders them in place of the page that
// failed (router.tsx, src/routes/_app/route.tsx). The error's details go to
// the log (the Worker's, when the server rendered it) and never to the page.
import type * as React from "react"
import {
  Link,
  useMatch,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Notice({
  title,
  children,
  actions,
}: {
  title: string
  children: string
  actions: React.ReactNode
}) {
  // Inside the shell it fills the column beside the sidebar; without one
  // (the shell's own data failed, or signed out) it fills the window.
  const inShell = useMatch({
    from: "/_app",
    shouldThrow: false,
    select: (match) => match.status === "success",
  })
  return (
    // Solid, like the chat shell: iOS Home Screen apps blur a see-through
    // top edge.
    <main
      id="main"
      tabIndex={-1}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4 bg-background p-12 safe-area text-center text-balance outline-hidden",
        inShell === true ? "min-h-0" : "min-h-dvh"
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-2">
        <h1 className="text-base font-medium">{title}</h1>
        <p className="text-sm/relaxed text-muted-foreground">{children}</p>
      </div>
      <div className="flex gap-2">{actions}</div>
    </main>
  )
}

function NewChatButton() {
  return (
    <Button variant="outline" render={<Link to="/" />}>
      New Chat
    </Button>
  )
}

function ErrorPage({ error }: ErrorComponentProps) {
  const router = useRouter()
  // In the render, not an effect, so the server's render logs it too.
  console.error("Page error:", error)
  return (
    <Notice
      title="Something went wrong."
      actions={
        <>
          <Button variant="primary" onClick={() => void router.invalidate()}>
            Try again
          </Button>
          <NewChatButton />
        </>
      }
    >
      This page hit an error. Try again, or start a new chat.
    </Notice>
  )
}

function NotFoundPage() {
  return (
    <Notice title="Not found." actions={<NewChatButton />}>
      This page or chat doesn&apos;t exist, or it was removed.
    </Notice>
  )
}

export { ErrorPage, NotFoundPage }
