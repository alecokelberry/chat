// A chat at /c/<id>: its thread and the composer, live over a WebSocket to
// the chat's agent (src/lib/chat). Messages load from the agent, so the
// server only checks the session and the browser renders the rest. A new
// chat arrives from / with its first message in history state: it skips
// loading (there's nothing yet), sends it, and clears the state so a
// reload doesn't send it again. Each message carries its model in its
// metadata (src/lib/ai/models.ts), so the picker reopens on the chat's last.
// A reload (or a second tab) while a reply streams picks it up where it is:
// useAgentChat asks the agent to resume, and the agent replays the chunks
// it has kept, then streams the rest.
import { Suspense, useEffect, useRef, useState } from "react"
import {
  createFileRoute,
  notFound,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router"
import { useAgent } from "agents/react"
import { useAgentChat } from "@cloudflare/ai-chat/react"

import { Composer } from "@/components/chat/composer"
import { Thread } from "@/components/chat/thread"
import { lastModel, type ModelKey } from "@/lib/ai/models"
import { getSession } from "@/lib/auth/session"
import { CHAT_ID } from "@/lib/chat/id"

declare module "@tanstack/react-router" {
  interface HistoryState {
    firstMessage?: { text: string; model: ModelKey }
  }
}

export const Route = createFileRoute("/c/$id")({
  beforeLoad: async ({ params }) => {
    if (!CHAT_ID.test(params.id)) throw notFound()
    if ((await getSession()) === null) throw redirect({ to: "/sign-in" })
  },
  ssr: "data-only",
  component: ChatScreen,
})

function ChatScreen() {
  const { id } = Route.useParams()
  return (
    <main className="sticky top-0 flex h-dvh flex-col bg-background safe-area text-foreground">
      <Suspense>
        <Chat key={id} id={id} />
      </Suspense>
    </main>
  )
}

function Chat({ id }: { id: string }) {
  const firstMessage = useLocation({ select: (l) => l.state.firstMessage })
  const [isNew] = useState(firstMessage !== undefined)
  const agent = useAgent({ agent: "ChatAgent", basePath: `api/chats/${id}` })
  const { messages, sendMessage, stop, status, isStreaming } = useAgentChat({
    agent,
    getInitialMessages: isNew ? null : undefined,
    // A new chat has no reply to pick back up. Trying anyway races its
    // first send and ends it early, so the screen would look idle until
    // the first word.
    resume: !isNew,
  })
  const navigate = useNavigate()
  const sent = useRef(false)

  useEffect(() => {
    if (firstMessage === undefined || sent.current) return
    sent.current = true
    void sendMessage({
      text: firstMessage.text,
      metadata: { model: firstMessage.model },
    })
    void navigate({ to: ".", replace: true, state: {} })
  }, [firstMessage, sendMessage, navigate])

  // isStreaming also covers a reply another tab started.
  const busy = status === "submitted" || status === "streaming" || isStreaming
  return (
    <>
      <Thread messages={messages} busy={busy} failed={status === "error"} />
      {/* 24px in and up from the screen's edges on a phone, in line with
          the thread's text; 16px in on a computer. */}
      <div className="mx-auto w-full max-w-composer px-2 pb-2 sm:px-0">
        <Composer
          busy={busy}
          defaultModel={firstMessage?.model ?? lastModel(messages).key}
          onSend={(text, model) =>
            void sendMessage({ text, metadata: { model } })
          }
          onStop={stop}
        />
      </div>
    </>
  )
}
