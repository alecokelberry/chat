// A chat at /c/<id>: its thread and the composer, beside the sidebar
// (src/routes/_app/route.tsx, which also checks the session), live over a
// WebSocket to the chat's agent (src/lib/chat). Messages load from the
// agent, so the browser renders the rest. When the agent says the chat
// list changed, the sidebar loads it again; when it says the chat is being
// deleted (from another tab), this tab goes to a new chat. A new
// chat arrives from / with its first message in history state: it skips
// loading (there's nothing yet), sends it, and clears the state so a
// reload doesn't send it again. Each message carries its model in its
// metadata (src/lib/ai/models.ts), so the picker reopens on the chat's last,
// and Retry, which regenerates the last reply in place, asks the same one.
// An edited question is sent in the old one's place, with the picker's
// model: the SDK drops it and everything after it, here and in the agent,
// and the reply is asked again.
// A reload (or a second tab) while a reply streams picks it up where it is:
// useAgentChat asks the agent to resume, and the agent replays the chunks
// it has kept, then streams the rest. Once the chat has a title (from the
// sidebar's list), it sits in a pill at the top: over the thread, which
// fades out under it, on a computer, and in the header row beside the
// sidebar button on a phone. At the header's end, the chat's … holds the
// same actions as its sidebar row (chat-actions.tsx); Rename there edits
// the title in the pill. In dev, ?data= shows made-up messages instead
// (src/lib/dev/worst-case.ts).
import { memo, Suspense, useEffect, useRef, useState } from "react"
import {
  createFileRoute,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { useAgent } from "agents/react"
import { useAgentChat } from "@cloudflare/ai-chat/react"
import { EllipsisIcon } from "lucide-react"

import { ChatMenuContent, RenameField } from "@/components/chat/chat-actions"
import { useChatList, type ChatRef } from "@/components/chat/chat-list"
import { NotFoundPage } from "@/components/error-page"
import { Composer } from "@/components/chat/composer"
import { Thread } from "@/components/chat/thread"
import { Button } from "@/components/ui/button"
import { HeaderTitle, HeaderTitleEdit } from "@/components/ui/header-title"
import { Menu, MenuTrigger } from "@/components/ui/menu"
import { lastModel, type ModelKey } from "@/lib/ai/models"
import { CHAT_DELETED, CHATS_CHANGED } from "@/lib/chat/events"
import { CHAT_ID } from "@/lib/chat/id"
import { previewMessages } from "@/lib/dev/worst-case"

declare module "@tanstack/react-router" {
  interface HistoryState {
    firstMessage?: { text: string; model: ModelKey }
  }
}

export const Route = createFileRoute("/_app/c/$id")({
  ssr: "data-only",
  component: ChatScreen,
})

function ChatScreen() {
  const { id } = Route.useParams()
  const chat = useChatList().chats.find((listed) => listed.id === id)
  // Not an id a chat can have: the not-found page, inside the shell.
  if (!CHAT_ID.test(id)) return <NotFoundPage />
  return (
    // No top pad: the header floats over the thread, whose own pad sets
    // where the last question rests (message-scroller.tsx).
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col safe-area pt-0 outline-hidden"
    >
      {chat !== undefined && <ChatHeader key={id} chat={chat} />}
      <Suspense>
        <Chat key={id} id={id} />
      </Suspense>
    </main>
  )
}

/** The pill once the chat has a title, and the chat's … at the end. */
function ChatHeader({ chat }: { chat: ChatRef }) {
  const [renaming, setRenaming] = useState(false)
  const actions = useRef<HTMLButtonElement>(null)
  return (
    // Taps go through to the page and the phone's sidebar button, 88px
    // clear of the pill on either side.
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 box-content flex h-header items-center justify-center px-22 pt-safe md:bg-linear-to-b md:from-background md:from-60%">
      {renaming ? (
        <HeaderTitleEdit>
          <RenameField
            chat={chat}
            onClose={() => setRenaming(false)}
            returnFocus={actions}
          />
        </HeaderTitleEdit>
      ) : (
        chat.title !== null && <HeaderTitle>{chat.title}</HeaderTitle>
      )}
      <div className="pointer-events-auto absolute end-4 bottom-0 flex h-header items-center">
        <Menu>
          <MenuTrigger
            render={
              <Button ref={actions} size="header" aria-label="Chat actions" />
            }
          >
            <EllipsisIcon aria-hidden />
          </MenuTrigger>
          <ChatMenuContent chat={chat} onRename={() => setRenaming(true)} />
        </Menu>
      </div>
    </header>
  )
}

// Memoized: the screen re-renders whenever the chat list changes (its
// header reads it), and the thread needn't.
const Chat = memo(function Chat({ id }: { id: string }) {
  const firstMessage = useLocation({ select: (l) => l.state.firstMessage })
  const [isNew] = useState(firstMessage !== undefined)
  const router = useRouter()
  const { data } = Route.useSearch()
  const agent = useAgent({
    agent: "ChatAgent",
    basePath: `api/chats/${id}`,
    onMessage: (event) => {
      if (event.data === CHATS_CHANGED) void router.invalidate()
      if (event.data === CHAT_DELETED) void router.navigate({ to: "/" })
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
  const [model, setModel] = useState(
    firstMessage?.model ?? lastModel(messages).key
  )

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
        messages={previewMessages(messages, data)}
        busy={busy}
        stopped={stopped}
        error={
          status === "error" ? (error?.message ?? "Request failed.") : undefined
        }
        onRetry={() => {
          setStopped(false)
          void regenerate()
        }}
        onEdit={(messageId, text) => {
          setStopped(false)
          void sendMessage({ text, messageId, metadata: { model } })
        }}
      />
      {/* 24px in and up from the screen's edges on a phone, in line with
          the thread's text; 16px in on a computer. */}
      <div className="mx-auto w-full max-w-composer px-2 pb-2 sm:px-0">
        <Composer
          busy={busy}
          model={model}
          onModelChange={setModel}
          onSend={(text) => {
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
})
