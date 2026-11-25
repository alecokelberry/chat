// A chat at /c/<id>: its thread and the composer, live over a WebSocket to
// the chat's agent (src/lib/chat). Messages load from the agent, so the
// server only checks the session and the browser renders the rest. A new
// chat arrives from / with its first message in history state: it skips
// loading (there's nothing yet), sends it, and clears the state so a
// reload doesn't send it again.
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
import { getSession } from "@/lib/auth/session"
import { CHAT_ID } from "@/lib/chat/id"

declare module "@tanstack/react-router" {
  interface HistoryState {
    firstMessage?: string
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
  })
  const navigate = useNavigate()
  const sent = useRef(false)

  useEffect(() => {
    if (firstMessage === undefined || sent.current) return
    sent.current = true
    void sendMessage({ text: firstMessage })
    void navigate({ to: ".", replace: true, state: {} })
  }, [firstMessage, sendMessage, navigate])

  // isStreaming also covers a reply another tab started.
  const busy = status === "submitted" || status === "streaming" || isStreaming
  return (
    <>
      <Thread messages={messages} busy={busy} failed={status === "error"} />
      <div className="mx-auto w-full max-w-content">
        <Composer
          busy={busy}
          onSend={(text) => void sendMessage({ text })}
          onStop={stop}
        />
      </div>
    </>
  )
}
