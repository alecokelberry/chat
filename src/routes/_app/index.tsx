// New chat: a greeting and the composer, 30% down the screen, beside the
// sidebar (src/routes/_app/route.tsx, which also checks the session). The
// first send makes the chat: a fresh id, then /c/<id> with the message and
// its model in history state, which that page sends once it's connected
// (src/routes/_app/c.$id.tsx).
import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Composer } from "@/components/chat/composer"
import { DEFAULT_MODEL } from "@/lib/ai/models"

export const Route = createFileRoute("/_app/")({
  component: NewChat,
})

function NewChat() {
  const navigate = useNavigate()
  const [model, setModel] = useState(DEFAULT_MODEL)
  return (
    // The archived Chat's (Grok's): the greeting 30% down and the composer
    // 28px under it, both staying put while the composer grows; the page
    // scrolls only if they don't fit. 24px in on a phone.
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto safe-area outline-hidden max-md:pt-0"
    >
      <h1 className="mt-new-chat-top px-4 pb-7 text-center text-3xl font-medium max-md:mt-new-chat-top-phone">
        What can I help with?
      </h1>
      <div className="mx-auto w-full max-w-composer px-2 sm:px-0">
        <Composer
          model={model}
          onModelChange={setModel}
          onSend={(text) =>
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
