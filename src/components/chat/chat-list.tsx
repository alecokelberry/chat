// The chat list the signed-in pages share (the sidebar and the open
// chat's header), with its changes: rename, pin and delete. A rename or
// pin shows at once (React's useOptimistic) while a server function
// writes it (src/lib/chat/list.ts); the list then loads again, and the
// chat's agent tells its other open tabs to as well. A failed write puts
// the list back and says so in a toast.
//
// Delete has Undo instead of a confirm (docs/decisions.md): the chat
// leaves the list at once (deleting the open one goes to a new chat) and
// a toast, "Chat deleted", offers Undo for its five seconds, longer while
// the pointer or focus is on it. Undo puts the chat back where it was.
// Only once the toast closes without Undo does the server delete it, so a
// tab closed mid-toast keeps the chat. The menu sends focus to the page
// (chat-actions.tsx); after going to a new chat, so does this.
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "@tanstack/react-router"

import { toast } from "@/components/ui/toast"
import { deleteChat, pinChat, renameChat } from "@/lib/chat/list"
import type { ChatSummary } from "@/lib/chat/store"

/** What the menu's actions need of a chat. */
export type ChatRef = Pick<ChatSummary, "id" | "title" | "pinned">

type ChatList = {
  chats: ChatSummary[]
  rename: (chat: ChatRef, title: string) => void
  pin: (chat: ChatRef, pinned: boolean) => void
  delete: (chat: ChatRef) => void
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

/** Moves focus to the page's <main> once a new chat has replaced the
 *  deleted one, if the menu's focus went with the old page. */
function focusNewPage() {
  if (
    document.activeElement === null ||
    document.activeElement === document.body
  )
    document.getElementById("main")?.focus()
}

export function ChatListProvider({
  chats: loaded,
  children,
}: {
  chats: ChatSummary[]
  children: ReactNode
}) {
  // Deleted, but still waiting on their toast.
  const [deleting, setDeleting] = useState<ReadonlySet<string>>(new Set())
  const listed = useMemo(
    () =>
      deleting.size === 0
        ? loaded
        : loaded.filter((chat) => !deleting.has(chat.id)),
    [loaded, deleting]
  )
  const [chats, showChange] = useOptimistic(listed, applyChange)
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
      delete: ({ id }) => {
        const hide = (hidden: boolean) =>
          setDeleting((all) => {
            const next = new Set(all)
            if (hidden) next.add(id)
            else next.delete(id)
            return next
          })
        hide(true)
        if (router.state.location.pathname === `/c/${id}`)
          void router.navigate({ to: "/" }).then(focusNewPage)
        let undone = false
        toast("Chat deleted", {
          action: {
            label: "Undo",
            onAction: () => {
              undone = true
              hide(false)
            },
          },
          onDismiss: () => {
            if (undone) return
            startTransition(async () => {
              try {
                await deleteChat({ data: { id } })
              } catch {
                toast.error("Couldn't delete the chat")
              }
              await router.invalidate()
              hide(false)
            })
          },
        })
      },
    }),
    [change, router]
  )
  const list = useMemo(() => ({ chats, ...actions }), [chats, actions])
  return <ChatListContext value={list}>{children}</ChatListContext>
}
