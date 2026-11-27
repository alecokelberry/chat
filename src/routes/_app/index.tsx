// New chat: a greeting and the composer, with the composer centered in the space
// under the header, beside the sidebar (src/routes/_app/route.tsx, which
// also checks the session). The first send makes the chat: a fresh id, then
// /c/<id> with the message and its model in history state (its images go
// through src/lib/chat/attachments.ts), which that page sends once it's
// connected (src/routes/_app/c.$id.tsx), and whose composer
// takes focus, so typing can go on. Three starters sit under the composer:
// a tap fills it (src/lib/chat/starters.ts), and they go once there's
// anything to send.
import { useRef, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Composer, type ComposerHandle } from "@/components/chat/composer"
import { DEFAULT_MODEL } from "@/lib/ai/models"
import { handOffFiles } from "@/lib/chat/attachments"
import { STARTERS } from "@/lib/chat/starters"
import { pageTitle } from "@/lib/utils"

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: pageTitle("New chat") }] }),
  component: NewChat,
})

function NewChat() {
  const navigate = useNavigate()
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [started, setStarted] = useState(false)
  const composer = useRef<ComposerHandle>(null)
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
      <div className="mx-auto h-14.5 w-full max-w-composer px-2 sm:px-0">
        <Composer
          ref={composer}
          onDraft={setStarted}
          model={model}
          onModelChange={setModel}
          onSend={(text, files) => {
            const id = crypto.randomUUID()
            handOffFiles(id, files)
            void navigate({
              to: "/c/$id",
              params: { id },
              state: { firstMessage: { text, model, files: files.length } },
            })
          }}
        />
      </div>
      {/* Under the composer, starting where the middle row ends, so the
          composer stays at the exact middle. Gone once there's a draft or
          a file: the composer grows down over this space, and Grok's
          suggestions leave then too. */}
      {!started && (
        <ul
          aria-label="Starters"
          className="mx-auto mt-3 w-full max-w-composer self-start px-2 sm:px-0"
        >
          {STARTERS.map(({ icon: Icon, text }) => (
            <li key={text}>
              <Button
                variant="starter"
                size="none"
                onClick={() => composer.current?.fill(text)}
              >
                <Icon data-icon="inline-start" aria-hidden />
                {text}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
