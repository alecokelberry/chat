// The chat list the signed-in pages share (the sidebar and the open
// chat's header), with its changes: rename, pin and delete. A rename or
// pin shows at once, over the loaded list, while a server function writes
// it (src/lib/chat/list.ts); the list then loads again, and the chat's
// agent tells its other open tabs to as well. A change stays shown until a
// load has it: a load that was already on its way when the write finished
// comes back without it, and dropping the change then would flick the row
// back and forth. A failed write drops it and says so in a toast.
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
  useEffect,
  useMemo,
  useRef,
  useState,
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

const ListChangedContext = createContext<(() => Promise<void>) | null>(null)

/** Loads the list again because the open chat's agent said it changed. A
 *  write this tab made is about to load it itself, so then this does
 *  nothing: one request, not two. Stable, so the chat screen doesn't
 *  re-render when the list does. */
export function useListChanged() {
  const listChanged = use(ListChangedContext)
  if (listChanged === null)
    throw new Error("useListChanged outside ChatListProvider")
  return listChanged
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
  const [changes, setChanges] = useState<Change[]>([])
  const router = useRouter()
  const writing = useRef(0)
  const listChanged = useCallback(
    () => (writing.current > 0 ? Promise.resolve() : router.invalidate()),
    [router]
  )
  const chats = useMemo(() => applyChanges(listed, changes), [listed, changes])
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
  // The timers that drop a change nothing confirmed, stopped on unmount.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])
  const change = useCallback(
    async (next: Change, write: () => Promise<unknown>, failed: string) => {
      const drop = () =>
        setChanges((shown) => shown.filter((other) => other !== next))
      // A newer change to the same field replaces the older one.
      const fields = Object.keys(next).filter((key) => key !== "id")
      setChanges((shown) => [
        ...shown.filter(
          (other) =>
            other.id !== next.id || !fields.some((field) => field in other)
        ),
        next,
      ])
      const timer = setTimeout(drop, SHOWN_FOR)
      timers.current.add(timer)
      // While a write is out, the open chat's announcement of it waits for
      // this load instead of making a second one (useListChanged).
      writing.current += 1
      try {
        try {
          await write()
        } catch {
          drop()
          toast.error(failed)
        }
        await router.invalidate()
      } finally {
        writing.current -= 1
      }
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
            void (async () => {
              try {
                await deleteChat({ data: { id } })
              } catch {
                toast.error("Couldn't delete the chat")
              }
              await router.invalidate()
              hide(false)
            })()
          },
        })
      },
    }),
    [change, router]
  )
  const list = useMemo(() => ({ chats, ...actions }), [chats, actions])
  return (
    <ChatListContext value={list}>
      <ListChangedContext value={listChanged}>{children}</ListChangedContext>
    </ChatListContext>
  )
}
