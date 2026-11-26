// A chat at /c/<id>: its thread and the composer, beside the sidebar
// (src/routes/_app/route.tsx, which also checks the session), live over a
// WebSocket to the chat's agent (src/lib/chat). Messages load from the
// agent, so the browser renders the rest. When the agent says the chat
// list changed, the sidebar loads it again. A new
// chat arrives from / with its first message in history state: it skips
// loading (there's nothing yet), sends it, and clears the state so a
// reload doesn't send it again. Each message carries its model in its
// metadata (src/lib/ai/models.ts), so the picker reopens on the chat's last,
// and Retry, which regenerates the last reply in place, asks the same one.
// A reload (or a second tab) while a reply streams picks it up where it is:
// useAgentChat asks the agent to resume, and the agent replays the chunks
// it has kept, then streams the rest. Once the chat has a title (from the
// sidebar's list), it sits in a pill at the top: over the thread, which
// fades out under it, on a computer, and in the header row beside the
// sidebar button on a phone.
import { Suspense, useEffect, useRef, useState } from "react"
import {
  createFileRoute,
  getRouteApi,
  notFound,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useAgent } from "agents/react"
import { useAgentChat } from "@cloudflare/ai-chat/react"

import { Composer } from "@/components/chat/composer"
import { Thread } from "@/components/chat/thread"
import { HeaderTitle } from "@/components/ui/header-title"
import { lastModel, type ModelKey } from "@/lib/ai/models"
import { CHATS_CHANGED } from "@/lib/chat/events"
import { CHAT_ID } from "@/lib/chat/id"

declare module "@tanstack/react-router" {
  interface HistoryState {
    firstMessage?: { text: string; model: ModelKey }
  }
}

export const Route = createFileRoute("/_app/c/$id")({
  beforeLoad: ({ params }) => {
    if (!CHAT_ID.test(params.id)) throw notFound()
  },
  ssr: "data-only",
  component: ChatScreen,
})

const appRoute = getRouteApi("/_app")

function ChatScreen() {
  const { id } = Route.useParams()
  const title = appRoute.useLoaderData({
    select: (chats) => chats.find((chat) => chat.id === id)?.title,
  })
  return (
    // No top pad: the header floats over the thread, whose own pad sets
    // where the last question rests (message-scroller.tsx).
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col safe-area pt-0 outline-hidden"
    >
      {typeof title === "string" && (
        // Taps go through to the page and the phone's sidebar button, 88px
        // clear of the pill on either side.
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 box-content flex h-header items-center justify-center px-22 pt-safe md:bg-linear-to-b md:from-background md:from-60%">
          <HeaderTitle>{title}</HeaderTitle>
        </header>
      )}
      <Suspense>
        <Chat key={id} id={id} />
      </Suspense>
    </main>
  )
}

function Chat({ id }: { id: string }) {
  const firstMessage = useLocation({ select: (l) => l.state.firstMessage })
  const [isNew] = useState(firstMessage !== undefined)
  const router = useRouter()
  const agent = useAgent({
    agent: "ChatAgent",
    basePath: `api/chats/${id}`,
    onMessage: (event) => {
      if (event.data === CHATS_CHANGED) void router.invalidate()
    },
  })
  const {
    messages,
    sendMessage,
    regenerate,
    stop,
    status,
    error,
    isStreaming,
  } = useAgentChat({
    agent,
    getInitialMessages: isNew ? null : undefined,
    // A new chat has no reply to pick back up. Trying anyway races its
    // first send and ends it early, so the screen would look idle until
    // the first word.
    resume: !isNew,
  })
  const navigate = useNavigate()
  const sent = useRef(false)
  // Stop shows the cut-off reply as it arrived, not paced (thread.tsx).
  const [stopped, setStopped] = useState(false)

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
      <Thread
        messages={messages}
        busy={busy}
        stopped={stopped}
        error={
          status === "error" ? (error?.message ?? "Request failed.") : undefined
        }
        onRetry={() => {
          setStopped(false)
          void regenerate()
        }}
      />
      {/* 24px in and up from the screen's edges on a phone, in line with
          the thread's text; 16px in on a computer. */}
      <div className="mx-auto w-full max-w-composer px-2 pb-2 sm:px-0">
        <Composer
          busy={busy}
          defaultModel={firstMessage?.model ?? lastModel(messages).key}
          onSend={(text, model) => {
            setStopped(false)
            void sendMessage({ text, metadata: { model } })
          }}
          onStop={() => {
            setStopped(true)
            return stop()
          }}
        />
      </div>
    </>
  )
}
