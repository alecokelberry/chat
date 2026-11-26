// The thread: a chat's messages, oldest first, in a log that opens at your
// last message and brings each new one to the top, the reply growing under
// it (message-scroller.tsx). Your messages sit in bubbles on the end side;
// replies are markdown across the column (reply.tsx). Until a reply's
// first word arrives, the waiting marker holds its place (pending-reply.tsx).
// The markdown renderer loads in the browser only, starting as this module
// does, so it's ready before the first message arrives over the WebSocket;
// a reply waits for it rather than flash its raw markdown. The server never
// imports it (the import.meta.env.SSR branch drops it from the Worker's
// build) and never renders a chat's messages (the route is data-only).
import { lazy, Suspense } from "react"
import type { UIMessage } from "ai"

import { PendingReply } from "@/components/chat/pending-reply"
import {
  MessageScroller,
  MessageScrollerItem,
} from "@/components/ui/message-scroller"

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
  const waiting = busy && (last?.role !== "assistant" || textOf(last) === "")
  return (
    <MessageScroller
      role="log"
      aria-label="Messages"
      aria-busy={busy}
      className="flex-1"
    >
      {messages.map((message) =>
        message.role === "user" ? (
          <MessageScrollerItem key={message.id} anchor>
            <article
              aria-label="Your message"
              className="max-w-4/5 self-end rounded-3xl bg-bubble-user px-4 py-2.5 break-words whitespace-pre-wrap"
            >
              {textOf(message)}
            </article>
          </MessageScrollerItem>
        ) : textOf(message) === "" ? null : (
          // A reply with no words yet: the waiting marker stands in for it.
          <MessageScrollerItem key={message.id}>
            <article aria-label="Reply">
              <Suspense>
                <Reply
                  text={textOf(message)}
                  streaming={busy && message === last}
                />
              </Suspense>
            </article>
          </MessageScrollerItem>
        )
      )}
      {waiting && <PendingReply />}
      {failed && (
        <p role="alert" className="text-destructive-foreground">
          The reply didn’t arrive. Send your message again to retry.
        </p>
      )}
    </MessageScroller>
  )
}
