// New chat: a greeting and the composer, centered together in the space under the
// header, beside the
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
    // The greeting and the composer 28px under it, centered as one block
    // sized for a one-line composer (h-14.5, its 58px): auto margins center
    // it, and the composer grows downward out of its slot, so the greeting
    // stays put while you type; the page scrolls if they stop fitting.
    // 24px in on a phone.
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto safe-area outline-hidden max-md:pt-0"
    >
      <div className="my-auto">
        <h1 className="px-4 pb-7 text-center text-3xl font-medium">
          What can I help with?
        </h1>
        <div className="mx-auto h-14.5 w-full max-w-composer px-2 sm:px-0">
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
      </div>
    </main>
  )
}
