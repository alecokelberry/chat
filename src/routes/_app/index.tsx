// New chat: a greeting and the composer, with the composer centered in the space
// under the header, beside the sidebar (src/routes/_app/route.tsx, which
// also checks the session). The first send makes the chat: a fresh id, then
// /c/<id> with the message and its model in history state, which that page
// sends once it's connected (src/routes/_app/c.$id.tsx), and whether focus
// was in the composer, so that page's composer takes it.
import { useRef, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Composer } from "@/components/chat/composer"
import { DEFAULT_MODEL } from "@/lib/ai/models"

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "New chat – Chat" }] }),
  component: NewChat,
})

function NewChat() {
  const navigate = useNavigate()
  const [model, setModel] = useState(DEFAULT_MODEL)
  const composer = useRef<HTMLDivElement>(null)
  return (
    // The one-line composer (h-14.5, its 58px) sits at the exact middle of
    // the space under the header: a 1fr / auto / 1fr grid, with the greeting
    // ending the top row, 28px above it. The padding's room (the notch, the
    // home indicator) is each outer row's minimum instead, so it can't pull
    // the middle off. The composer grows downward out of its slot, so the
    // greeting stays put while you type; the page scrolls if they stop
    // fitting. 24px in on a phone.
    <main
      id="main"
      tabIndex={-1}
      className="grid min-h-0 flex-1 grid-rows-centered overflow-y-auto py-0 safe-area outline-hidden"
    >
      <h1 className="self-end px-4 pb-7 text-center text-3xl font-medium">
        What can I help with?
      </h1>
      <div
        ref={composer}
        className="mx-auto h-14.5 w-full max-w-composer px-2 sm:px-0"
      >
        <Composer
          model={model}
          onModelChange={setModel}
          onSend={(text) =>
            void navigate({
              to: "/c/$id",
              params: { id: crypto.randomUUID() },
              state: {
                firstMessage: {
                  text,
                  model,
                  focused:
                    composer.current?.contains(document.activeElement) === true,
                },
              },
            })
          }
        />
      </div>
    </main>
  )
}
