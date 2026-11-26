// The signed-in shell: the sidebar beside the page. From md up it's a
// column; on a phone it's a drawer from the start edge, opened from a
// header above the page, and it closes when you pick a row. It holds New
// Chat and the chat list, grouped by the browser's own day
// (src/lib/chat/groups.ts), newest first; a chat without a title yet shows
// "New chat".
//
// The list needs the browser's time zone, so it renders only in the
// browser, in the one place the screen's width calls for (not both, which
// would double 1,000 rows). The server renders the column with New Chat.
// Each row is memoized, so a reloaded list re-renders only the rows that
// changed. The drawer opens with a screenful of rows and adds the rest once
// it has settled: mounting 1,000 at once froze the slide halfway.
import {
  memo,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { Link } from "@tanstack/react-router"

import { NewChatGlyph } from "@/components/ui/new-chat-glyph"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarDrawer,
  SidebarDrawerContent,
  SidebarDrawerTrigger,
  SidebarGroup,
  SidebarHeader,
  SidebarItem,
  SidebarRow,
} from "@/components/ui/sidebar"
import { groupChats } from "@/lib/chat/groups"
import type { ChatSummary } from "@/lib/chat/store"

const NO_CHATS: ChatSummary[] = []

/** More rows than the tallest phone shows: what the drawer opens with. */
const FIRST_SCREEN = 40

/** Phones, as Tailwind's `max-md`: the drawer instead of the column. */
const PHONE = "(width < 48rem)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** Whether the screen is a phone's; null on the server and while
 *  hydrating. */
function usePhone(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => null
  )
}

export function ChatSidebar({
  chats,
  children,
}: {
  chats: ChatSummary[]
  children: ReactNode
}) {
  const phone = usePhone()
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <div className="sticky top-0 flex h-dvh bg-background text-foreground">
      <Sidebar aria-label="Chats">
        <SidebarHeader>
          <NewChatLink />
        </SidebarHeader>
        {phone === false && <ChatList chats={chats} />}
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col">
        <SidebarDrawer
          open={open && phone === true}
          onOpenChange={setOpen}
          onOpenChangeComplete={setOpened}
          themeColor
        >
          <header className="box-content flex h-header shrink-0 items-center px-3 pt-safe md:hidden">
            <SidebarDrawerTrigger />
          </header>
          {phone === true && (
            <SidebarDrawerContent title="Chats">
              <SidebarHeader>
                <NewChatLink onClick={close} />
              </SidebarHeader>
              <ChatList
                chats={chats}
                limit={opened ? undefined : FIRST_SCREEN}
                onPick={close}
              />
            </SidebarDrawerContent>
          )}
        </SidebarDrawer>
        {children}
      </div>
    </div>
  )
}

function NewChatLink({ onClick }: { onClick?: () => void }) {
  return (
    <SidebarRow variant="raised" render={<Link to="/" />} onClick={onClick}>
      <NewChatGlyph />
      <span>New Chat</span>
    </SidebarRow>
  )
}

function ChatList({
  chats,
  limit,
  onPick,
}: {
  chats: ChatSummary[]
  /** Only the newest this many, while the drawer slides. */
  limit?: number
  onPick?: () => void
}) {
  const listed = useMemo(
    () => (limit === undefined ? chats : chats.slice(0, limit)),
    [chats, limit]
  )
  // The list renders at low priority, so a long one never holds up a
  // streaming reply or a tap: React drops the work when something urgent
  // comes in, and starts it again after.
  const shown = useDeferredValue(listed, NO_CHATS)
  const groups = useMemo(() => groupChats(shown, Date.now()), [shown])
  return (
    <ScrollArea aria-label="Chat list" className="flex-1">
      <div className="pb-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label} label={group.label}>
            {group.chats.map((chat) => (
              <ChatRow
                key={chat.id}
                id={chat.id}
                title={chat.title}
                onPick={onPick}
              />
            ))}
          </SidebarGroup>
        ))}
      </div>
    </ScrollArea>
  )
}

const ChatRow = memo(function ChatRow({
  id,
  title,
  onPick,
}: {
  id: string
  title: string | null
  onPick?: () => void
}) {
  return (
    <SidebarItem>
      {/* No preload on hover: it would ask the server for the session once
          per row the pointer crosses. */}
      <SidebarRow
        render={<Link to="/c/$id" params={{ id }} preload={false} />}
        onClick={onPick}
      >
        <span>{title ?? "New chat"}</span>
      </SidebarRow>
    </SidebarItem>
  )
})
