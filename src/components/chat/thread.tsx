// The thread: a chat's messages, oldest first, in a log that follows the
// reply as it streams (until you scroll up). Your messages sit in bubbles
// on the end side; replies are plain text across the column for now
// (markdown arrives with its own ticket).
import type { UIMessage } from "ai"

import { ScrollArea } from "@/components/ui/scroll-area"

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
            <article
              key={message.id}
              aria-label="Reply"
              className="break-words whitespace-pre-wrap"
            >
              {textOf(message)}
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
