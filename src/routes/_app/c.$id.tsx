// A chat at /c/<id>: its thread and the composer (src/components/chat/chat.tsx,
// which also holds the WebSocket to the chat's agent), beside the sidebar
// (src/routes/_app/route.tsx, which also checks the session). A new chat
// arrives from / with its first message in history state, which the chat
// sends once and this page then clears, so a reload doesn't send it again.
// The tab is titled after the chat, from the list the layout loaded, so it
// follows a rename or the model naming it once the list loads again. Once
// the chat has a title (from the sidebar's list), it sits in a pill at the
// top: over the thread, which fades out under it, on a computer, and in the
// header row beside the sidebar button on a phone. At the header's end, the
// chat's … holds the same actions as its sidebar row (chat-actions.tsx);
// Rename there edits the title in the pill.
import { Suspense, useCallback, useRef, useState } from "react"
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router"
import { EllipsisIcon } from "lucide-react"

import {
  Chat,
  ChatHeaderBar,
  ChatPage,
  type FirstMessage,
} from "@/components/chat/chat"
import { ChatMenuContent, RenameField } from "@/components/chat/chat-actions"
import { useChatList, type ChatRef } from "@/components/chat/chat-list"
import { NotFoundPage } from "@/components/error-page"
import { Button } from "@/components/ui/button"
import { HeaderTitle, HeaderTitleEdit } from "@/components/ui/header-title"
import { Menu, MenuTrigger } from "@/components/ui/menu"
import { CHAT_ID } from "@/lib/chat/id"
import { pageTitle } from "@/lib/utils"

declare module "@tanstack/react-router" {
  interface HistoryState {
    firstMessage?: FirstMessage
  }
}

export const Route = createFileRoute("/_app/c/$id")({
  ssr: "data-only",
  loader: ({ params, context }) => ({
    title: context.chats.find((chat) => chat.id === params.id)?.title ?? null,
  }),
  head: ({ params, loaderData }) => ({
    meta: [
      {
        title: CHAT_ID.test(params.id)
          ? pageTitle(loaderData?.title ?? "New chat")
          : pageTitle("Not found"),
      },
    ],
  }),
  component: ChatScreen,
})

function ChatScreen() {
  const { id } = Route.useParams()
  const chat = useChatList().chats.find((listed) => listed.id === id)
  // Not an id a chat can have: the not-found page, inside the shell.
  if (!CHAT_ID.test(id)) return <NotFoundPage />
  return (
    <ChatPage>
      {chat !== undefined && <ChatHeader key={id} chat={chat} />}
      <Suspense>
        <RoutedChat key={id} id={id} />
      </Suspense>
    </ChatPage>
  )
}

/** The pill once the chat has a title, and the chat's … at the end. */
function ChatHeader({ chat }: { chat: ChatRef }) {
  const [renaming, setRenaming] = useState(false)
  const actions = useRef<HTMLButtonElement>(null)
  return (
    <ChatHeaderBar>
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
    </ChatHeaderBar>
  )
}

/** The chat, with the first message a new chat brought from / in history
 *  state, cleared once it's sent so a reload doesn't send it again. */
function RoutedChat({ id }: { id: string }) {
  const firstMessage = useLocation({ select: (l) => l.state.firstMessage })
  const navigate = useNavigate()
  const onFirstSent = useCallback(
    () => void navigate({ to: ".", replace: true, state: {} }),
    [navigate]
  )
  return <Chat id={id} firstMessage={firstMessage} onFirstSent={onFirstSent} />
}
