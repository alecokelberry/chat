// The thread: a chat's messages, oldest first, in a log that follows the
// reply as it streams (until you scroll up). Your messages sit in bubbles
// on the end side; replies are markdown across the column (reply.tsx).
// The markdown renderer loads in the browser only, starting as this module
// does, so it's ready before the first message arrives over the WebSocket;
// a reply waits for it rather than flash its raw markdown. The server never
// imports it (the import.meta.env.SSR branch drops it from the Worker's
// build) and never renders a chat's messages (the route is data-only).
import { lazy, Suspense } from "react"
import type { UIMessage } from "ai"

import { ScrollArea } from "@/components/ui/scroll-area"

const Reply = import.meta.env.SSR ? () => null : loadReply()

function loadReply() {
  const reply = import("@/components/chat/reply")
  return lazy(() => reply)
}

const textOf = (message: UIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")

export function Thread({
  messages,
  busy,
  failed,
}: {
  messages: UIMessage[]
  busy: boolean
  failed: boolean
}) {
  const last = messages.at(-1)
  return (
    <ScrollArea
      stickToEnd
      role="log"
      aria-label="Messages"
      aria-busy={busy}
      className="flex-1"
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 pb-6">
        {messages.map((message) =>
          message.role === "user" ? (
            <article
              key={message.id}
              aria-label="Your message"
              className="max-w-4/5 self-end rounded-3xl bg-bubble-user px-4 py-2.5 break-words whitespace-pre-wrap"
            >
              {textOf(message)}
            </article>
          ) : (
            <article key={message.id} aria-label="Reply">
              <Suspense>
                <Reply
                  text={textOf(message)}
                  streaming={busy && message === last}
                />
              </Suspense>
            </article>
          )
        )}
        {failed && (
          <p role="alert" className="text-destructive-foreground">
            The reply didn’t arrive. Send your message again to retry.
          </p>
        )}
      </div>
    </ScrollArea>
  )
}
