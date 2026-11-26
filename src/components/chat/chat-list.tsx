// The chat list the signed-in pages share (the sidebar and the open
// chat's header), with its two changes, rename and pin. A change shows at
// once (React's useOptimistic) while a server function writes it
// (src/lib/chat/list.ts); the list then loads again, and the chat's agent
// tells its other open tabs to as well. A failed write puts the list back
// and says so in a toast.
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "@tanstack/react-router"

import { toast } from "@/components/ui/toast"
import { pinChat, renameChat } from "@/lib/chat/list"
import type { ChatSummary } from "@/lib/chat/store"

/** What renaming and pinning need of a chat. */
export type ChatRef = Pick<ChatSummary, "id" | "title" | "pinned">

type ChatList = {
  chats: ChatSummary[]
  rename: (chat: ChatRef, title: string) => void
  pin: (chat: ChatRef, pinned: boolean) => void
}

const ChatListContext = createContext<ChatList | null>(null)

export function useChatList(): ChatList {
  const list = use(ChatListContext)
  if (list === null) throw new Error("useChatList outside ChatListProvider")
  return list
}

type Change = Pick<ChatSummary, "id"> & Partial<ChatSummary>

/** The list with one chat changed, sorted the way the server sorts it
 *  (listChats): pins first, then latest activity, then id. */
function applyChange(chats: ChatSummary[], change: Change): ChatSummary[] {
  return chats
    .map((chat) => (chat.id === change.id ? { ...chat, ...change } : chat))
    .toSorted(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updatedAt - a.updatedAt ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )
}

export function ChatListProvider({
  chats: loaded,
  children,
}: {
  chats: ChatSummary[]
  children: ReactNode
}) {
  const [chats, showChange] = useOptimistic(loaded, applyChange)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const change = useCallback(
    (next: Change, write: () => Promise<unknown>, failed: string) =>
      startTransition(async () => {
        showChange(next)
        try {
          await write()
        } catch {
          toast.error(failed)
        }
        await router.invalidate()
      }),
    [router, showChange]
  )
  // The actions don't change with the list, so the sidebar's memoized
  // rows, which take them, don't re-render when it reloads.
  const actions = useMemo<Omit<ChatList, "chats">>(
    () => ({
      rename: (chat, title) => {
        const clean = title.trim()
        if (clean === "" || clean === chat.title) return
        change(
          { id: chat.id, title: clean },
          () => renameChat({ data: { id: chat.id, title: clean } }),
          "Couldn't rename the chat"
        )
      },
      pin: (chat, pinned) =>
        change(
          { id: chat.id, pinned },
          () => pinChat({ data: { id: chat.id, pinned } }),
          pinned ? "Couldn't pin the chat" : "Couldn't unpin the chat"
        ),
    }),
    [change]
  )
  const list = useMemo(() => ({ chats, ...actions }), [chats, actions])
  return <ChatListContext value={list}>{children}</ChatListContext>
}
