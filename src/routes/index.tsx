// New chat: a greeting and the composer. Only a signed-in browser gets
// here; anyone else goes to /sign-in. The first send makes the chat: a
// fresh id, then /c/<id> with the message and its model in history
// state, which that page sends once it's connected (src/routes/c.$id.tsx).
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
    <main className="sticky top-0 flex min-h-dvh flex-col items-center justify-center gap-8 bg-background safe-area text-foreground">
      <h1 className="text-3xl font-medium">Hi, {user.name}</h1>
      <div className="w-full max-w-content">
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
