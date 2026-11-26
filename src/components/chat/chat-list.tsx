// The chat list the signed-in pages share (the sidebar and the open
// chat's header), with its two changes, rename and pin. A change shows at
// once, over the loaded list, while a server function writes it
// (src/lib/chat/list.ts); the list then loads again, and the chat's agent
// tells its other open tabs to as well. A change stays shown until a load
// has it: a load that was already on its way when the write finished comes
// back without it, and dropping the change then would flick the row back
// and forth. A failed write drops it and says so in a toast.
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
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

/** How long a change that no load has confirmed stays shown, in case
 *  something else changed the chat meanwhile. */
const SHOWN_FOR = 10_000

/** Whether `chat` already has everything in `change`. */
function has(chat: ChatSummary, change: Change): boolean {
  const fields: Record<string, unknown> = chat
  return Object.entries(change).every(([key, value]) => fields[key] === value)
}

/** The list with the changes applied, sorted the way the server sorts it
 *  (listChats): pins first, then latest activity, then id. */
function applyChanges(chats: ChatSummary[], changes: Change[]): ChatSummary[] {
  if (changes.length === 0) return chats
  return chats
    .map((chat) =>
      changes.reduce<ChatSummary>(
        (shown, change) =>
          change.id === shown.id ? { ...shown, ...change } : shown,
        chat
      )
    )
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
  const [changes, setChanges] = useState<Change[]>([])
  const router = useRouter()
  const chats = useMemo(() => applyChanges(loaded, changes), [loaded, changes])
  // A change goes once a load has it, or its chat is gone (adjusting state
  // while rendering, as React's docs suggest, so no frame shows both).
  const [seen, setSeen] = useState(loaded)
  if (seen !== loaded) {
    setSeen(loaded)
    const waiting = changes.filter((change) => {
      const chat = loaded.find(({ id }) => id === change.id)
      return chat !== undefined && !has(chat, change)
    })
    if (waiting.length !== changes.length) setChanges(waiting)
  }
  const change = useCallback(
    async (next: Change, write: () => Promise<unknown>, failed: string) => {
      const drop = () =>
        setChanges((shown) => shown.filter((other) => other !== next))
      setChanges((shown) => [...shown, next])
      setTimeout(drop, SHOWN_FOR)
      try {
        await write()
      } catch {
        drop()
        toast.error(failed)
      }
      await router.invalidate()
    },
    [router]
  )
  // The actions don't change with the list, so the sidebar's memoized
  // rows, which take them, don't re-render when it reloads.
  const actions = useMemo<Omit<ChatList, "chats">>(
    () => ({
      rename: (chat, title) => {
        const clean = title.trim()
        if (clean === "" || clean === chat.title) return
        void change(
          { id: chat.id, title: clean },
          () => renameChat({ data: { id: chat.id, title: clean } }),
          "Couldn't rename the chat"
        )
      },
      pin: (chat, pinned) =>
        void change(
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
