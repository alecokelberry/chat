// New chat: a greeting and the composer, 30% down the screen. Only a
// signed-in browser gets here; anyone else goes to /sign-in. The first send
// makes the chat: a fresh id, then /c/<id> with the message and its model
// in history state, which that page sends once it's connected
// (src/routes/c.$id.tsx).
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { Composer } from "@/components/chat/composer"
import { getSession } from "@/lib/auth/session"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const user = await getSession()
    if (user === null) throw redirect({ to: "/sign-in" })
    return { user }
  },
  component: NewChat,
})

function NewChat() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  return (
    // The archived Chat's (Grok's): the greeting 30% down and the composer
    // 28px under it, both staying put while the composer grows; the page
    // scrolls only if they don't fit. 24px in on a phone.
    <main className="sticky top-0 flex min-h-dvh flex-col bg-background safe-area text-foreground">
      <h1 className="mt-new-chat-top px-4 pb-7 text-center text-3xl font-medium">
        Hi, {user.name}
      </h1>
      <div className="mx-auto w-full max-w-composer px-2 sm:px-0">
        <Composer
          onSend={(text, model) =>
            void navigate({
              to: "/c/$id",
              params: { id: crypto.randomUUID() },
              state: { firstMessage: { text, model } },
            })
          }
        />
      </div>
    </main>
  )
}
