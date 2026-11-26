// The thread: a chat's messages, oldest first, in a log that opens at your
// last message and brings each new one to the top, the reply growing under
// it (message-scroller.tsx). Your messages sit in bubbles on the end side;
// replies are markdown across the column (reply.tsx), each with its actions,
// who answered and how long it took under it once it has finished
// (reply-actions.tsx). A model that thinks shows its reasoning above the
// reply in a closed step, "Thinking…" until the answer's first word, then
// how long it thought (ui/reply-step.tsx). Until a reply's first word or
// thought arrives, the waiting marker holds its place (pending-reply.tsx).
// A failed reply ends the thread with one quiet line saying why, and Retry.
// The markdown renderer loads in the browser only, starting as this module
// does, so it's ready before the first message arrives over the WebSocket;
// a reply waits for it rather than flash its raw markdown. The server never
// imports it (the import.meta.env.SSR branch drops it from the Worker's
// build) and never renders a chat's messages (the route is data-only).
import { lazy, Suspense } from "react"
import type { ReasoningUIPart, UIMessage } from "ai"
import { BrainIcon, CircleAlertIcon, RefreshCwIcon } from "lucide-react"

import { PendingReply } from "@/components/chat/pending-reply"
import { ReplyActions } from "@/components/chat/reply-actions"
import { Button } from "@/components/ui/button"
import { ReplyStep } from "@/components/ui/reply-step"
import { answeredBy, thoughtFor } from "@/lib/chat/reply-metadata"
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

const thoughtsOf = (message: UIMessage) =>
  message.parts.filter(
    (part): part is ReasoningUIPart => part.type === "reasoning"
  )

/** A reply with no words or thoughts yet. */
const isBlank = (message: UIMessage) =>
  textOf(message) === "" && thoughtsOf(message).length === 0

export function Thread({
  messages,
  busy,
  stopped,
  error,
  onRetry,
}: {
  messages: UIMessage[]
  busy: boolean
  /** The last reply was cut off by Stop. */
  stopped: boolean
  /** Why the last reply failed, if it did. */
  error: string | undefined
  /** Asks again for the last reply, replacing it. */
  onRetry: () => void
}) {
  const last = messages.at(-1)
  const waiting = busy && (last?.role !== "assistant" || isBlank(last))
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
              className="max-w-4/5 self-end rounded-3xl bg-bubble-user px-4 py-3 break-words whitespace-pre-wrap"
            >
              {textOf(message)}
            </article>
          </MessageScrollerItem>
        ) : isBlank(message) ? null : (
          // A reply with no words or thoughts yet: the waiting marker stands
          // in for it.
          <MessageScrollerItem key={message.id}>
            <ReplyMessage
              message={message}
              streaming={busy && message === last}
              stopped={stopped && message === last}
              latest={message === last}
              // The error line has its own Retry.
              onRetry={
                message === last && error === undefined ? onRetry : undefined
              }
            />
          </MessageScrollerItem>
        )
      )}
      {waiting && <PendingReply />}
      {error !== undefined && (
        <div
          role="alert"
          className="flex min-h-8 items-center gap-2 text-muted-foreground"
        >
          <CircleAlertIcon aria-hidden className="size-4 text-destructive" />
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            data-agent-confirm="Asks the model again for this reply"
          >
            <RefreshCwIcon data-icon="inline-start" aria-hidden />
            Retry
          </Button>
        </div>
      )}
    </MessageScroller>
  )
}

/** A reply: what the model thought, its markdown, then its actions once
 *  it has finished. */
function ReplyMessage({
  message,
  streaming,
  stopped,
  latest,
  onRetry,
}: {
  message: UIMessage
  /** Still arriving. */
  streaming: boolean
  /** Cut off by Stop. */
  stopped: boolean
  latest: boolean
  onRetry: (() => void) | undefined
}) {
  const text = textOf(message)
  return (
    <div data-slot="message" className="group/message flex flex-col gap-2.5">
      <Thinking message={message} running={streaming && text === ""} />
      {text !== "" && (
        <article aria-label="Reply">
          <Suspense>
            <Reply text={text} streaming={streaming} stopped={stopped} />
          </Suspense>
        </article>
      )}
      {!streaming && (
        <ReplyActions
          text={text}
          latest={latest}
          answeredBy={answeredBy(message.metadata)}
          onRetry={onRetry}
        />
      )}
    </div>
  )
}

/** A reply's reasoning, if the model thought. Nothing for an empty
 *  thought. */
function Thinking({
  message,
  running,
}: {
  message: UIMessage
  /** Still thinking: the reply is arriving and has no words yet. */
  running: boolean
}) {
  const thoughts = thoughtsOf(message)
  const text = thoughts
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n")
  if (thoughts.length === 0 || (!running && text === "")) return null
  return (
    <ReplyStep
      icon={<BrainIcon />}
      label={running ? "Thinking…" : thoughtFor(message.metadata)}
      running={running}
    >
      {text}
    </ReplyStep>
  )
}
