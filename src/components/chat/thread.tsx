// The thread: a chat's messages, oldest first, in a log that opens at your
// last message and brings each new one to the top, the reply growing under
// it (message-scroller.tsx). Your messages sit in bubbles on the end side,
// each with Edit and Copy (question.tsx); replies are markdown across the
// column (reply.tsx), each with its actions, who answered and how long it
// took under it once it has finished (reply-actions.tsx). A model that
// thinks shows its reasoning above the reply in a closed step,
// "Thinking…" until the answer's first word, then how long it thought
// (ui/reply-step.tsx). A reply that searched the web shows a step like it,
// "Searching the web…" while a search runs, then how many sites it found,
// opening to each query and its results, and "Reading the page…" for a
// page the model reads (each read listed with the page it found); the
// sites found sit under the reply as links (sources.tsx). Until a reply's first word, thought or
// search arrives, and again while it reads what a search found, the
// waiting marker holds its place (pending-reply.tsx).
// A failed reply ends the thread with one quiet line saying why, and Retry.
// Search's preview shows a chat read-only (ThreadPreview): its questions
// and replies' words, nothing else.
// The markdown renderer loads in the browser only, starting as this module
// does, so it's ready before the first message arrives over the WebSocket;
// a reply waits for it rather than flash its raw markdown. The server never
// imports it (the import.meta.env.SSR branch drops it from the Worker's
// build) and never renders a chat's messages (the route is data-only).
import { lazy, Suspense } from "react"
import type { ReasoningUIPart, UIMessage } from "ai"
import {
  BrainIcon,
  CircleAlertIcon,
  GlobeIcon,
  RefreshCwIcon,
} from "lucide-react"

import { PendingReply } from "@/components/chat/pending-reply"
import { Question, QuestionBubble } from "@/components/chat/question"
import { ReplyActions } from "@/components/chat/reply-actions"
import { Sources } from "@/components/chat/sources"
import { Button } from "@/components/ui/button"
import { ReplyStep } from "@/components/ui/reply-step"
import { imagesOf } from "@/lib/chat/attachments"
import { documentsOf } from "@/lib/chat/documents"
import { answeredBy, thoughtFor } from "@/lib/chat/reply-metadata"
import {
  searchedLabel,
  searchesOf,
  sourcesOf,
  type Search,
} from "@/lib/chat/searches"
import {
  MessageScroller,
  MessageScrollerItem,
} from "@/components/ui/message-scroller"
import type { ModelKey } from "@/lib/ai/models"
import type { AttachmentPart } from "@/lib/chat/attachments"

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
const isWordless = (message: UIMessage) =>
  textOf(message) === "" && thoughtsOf(message).length === 0

/** What the waiting marker stands in for: a reply with nothing yet, or
 *  one that has searched and is reading the results. */
function isWaiting(message: UIMessage) {
  if (!isWordless(message)) return false
  const searches = searchesOf(message)
  return !searches.some((search) => search.running)
}

/** A reply with nothing to show yet. */
const isBlank = (message: UIMessage) =>
  isWordless(message) && searchesOf(message).length === 0

export function Thread({
  messages,
  busy,
  stopped,
  error,
  onRetry,
  model,
  onModelChange,
  onEdit,
}: {
  messages: UIMessage[]
  busy: boolean
  /** The last reply was cut off by Stop. */
  stopped: boolean
  /** Why the last reply failed, if it did. */
  error: string | undefined
  /** Asks again for the last reply, replacing it. */
  onRetry: () => void
  /** The model an edit asks, for its can't-see check. */
  model: ModelKey
  onModelChange: (model: ModelKey) => void
  /** Replaces a question, and everything after it, with new words and
   *  attachments. */
  onEdit: (id: string, text: string, attachments: AttachmentPart[]) => void
}) {
  const last = messages.at(-1)
  const waiting = busy && (last?.role !== "assistant" || isWaiting(last))
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
            <Question
              text={textOf(message)}
              images={imagesOf(message)}
              documents={documentsOf(message)}
              busy={busy}
              model={model}
              onModelChange={onModelChange}
              onEdit={(text, attachments) =>
                onEdit(message.id, text, attachments)
              }
            />
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

/** A chat's messages, read-only, for Search's preview: each question's
 *  bubble and each reply's markdown, without steps or actions. */
export function ThreadPreview({ messages }: { messages: UIMessage[] }) {
  return (
    <div className="flex flex-col gap-6">
      {messages.map((message) => {
        const text = textOf(message)
        if (text === "") return null
        return message.role === "user" ? (
          <QuestionBubble key={message.id}>{text}</QuestionBubble>
        ) : (
          <article key={message.id} aria-label="Reply">
            <Suspense>
              <Reply text={text} streaming={false} stopped={false} />
            </Suspense>
          </article>
        )
      })}
    </div>
  )
}

/** A reply: what the model thought and searched, its markdown, then its
 *  sources and actions once it has finished. */
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
  const searches = searchesOf(message)
  return (
    <div data-slot="message" className="group/message flex flex-col gap-2.5">
      <Thinking message={message} running={streaming && text === ""} />
      <Searching
        searches={searches}
        running={streaming && searches.some((search) => search.running)}
      />
      {text !== "" && (
        <article aria-label="Reply">
          <Suspense>
            <Reply text={text} streaming={streaming} stopped={stopped} />
          </Suspense>
        </article>
      )}
      {!streaming && <Sources sources={sourcesOf(searches)} />}
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

/** A reply's web searches and page reads, if it made any: each query or
 *  address, and what it found. */
function Searching({
  searches,
  running,
}: {
  searches: Search[]
  /** A search is still waiting for its results. */
  running: boolean
}) {
  if (searches.length === 0) return null
  return (
    <ReplyStep
      icon={<GlobeIcon />}
      label={searchedLabel(searches, running)}
      running={running}
    >
      <ul className="flex flex-col gap-3 whitespace-normal">
        {searches.map((search, i) => (
          <li key={i} className="flex flex-col gap-1">
            <span className="wrap-anywhere text-foreground">
              {search.kind === "read" ? `Read ${search.query}` : search.query}
            </span>
            {search.error !== undefined ? (
              <span>{search.error}</span>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {search.results.map((result) => (
                  <li key={result.url} className="min-w-0 truncate">
                    {result.title} · {result.site}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </ReplyStep>
  )
}
