// The signed-in shell: the sidebar beside the page. From md up it's a
// column; on a phone it's a drawer from the start edge, opened from a
// header above the page, and it closes when you pick a row. It holds New
// Chat, the chat list, pinned chats first, then grouped by the browser's
// own day (src/lib/chat/groups.ts), newest first (a chat without a title
// yet shows "New chat"), and the account row at the bottom
// (account-menu.tsx).
//
// On a computer the column collapses to a rail from its toggle or ⌘B
// (Ctrl+B elsewhere), remembered in a cookie (src/lib/sidebar.ts). The
// list stays mounted but hidden in the rail, so expanding never builds
// 1,000 rows.
//
// The list needs the browser's time zone, so it renders only in the
// browser, in the one place the screen's width calls for (not both, which
// would double 1,000 rows). The server renders the column with New Chat.
// Each row is memoized, so a reloaded list re-renders only the rows that
// changed. A tap on the phone header's button before the page's scripts
// have run (a slow network, a cold start) isn't lost: a script in the
// server's HTML (ScriptOnce) notes it, and the button replays it once React
// has hydrated. The drawer opens with a screenful of rows and adds the rest
// once it has settled: mounting 1,000 at once froze the slide halfway.
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { Link, ScriptOnce } from "@tanstack/react-router"

import { AccountMenu, type Account } from "@/components/chat/account-menu"
import { NewChatGlyph } from "@/components/ui/new-chat-glyph"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarDrawer,
  SidebarDrawerContent,
  SidebarDrawerTrigger,
  SidebarGroup,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarRow,
  SidebarToggle,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { groupChats } from "@/lib/chat/groups"
import { saveSidebarCollapsed } from "@/lib/sidebar"
import type { ChatSummary } from "@/lib/chat/store"

const NO_CHATS: ChatSummary[] = []

const TRIGGER_ID = "sidebar-trigger"

/** Runs from the server's HTML, before React: notes a press on the phone
 *  header's sidebar button until React takes over (takeEarlyTap). */
const EARLY_TAP = `(() => {
  const note = (event) => {
    if (event.target.closest?.('#${TRIGGER_ID}')) early.tapped = true
  }
  const early = { tapped: false, stop: () => document.removeEventListener("click", note, true) }
  window.sidebarEarlyTap = early
  document.addEventListener("click", note, true)
})()`

/** Whether the sidebar button was pressed before React hydrated; stops
 *  listening, since React's own handler takes it from here. */
function takeEarlyTap(): boolean {
  if (!("sidebarEarlyTap" in window)) return false
  const early = window.sidebarEarlyTap
  delete window.sidebarEarlyTap
  if (typeof early !== "object" || early === null) return false
  if ("stop" in early && typeof early.stop === "function") early.stop()
  return "tapped" in early && early.tapped === true
}

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
  account,
  chats,
  collapsed: startCollapsed,
  children,
}: {
  account: Account
  chats: ChatSummary[]
  /** Whether the computer's column starts as a rail. */
  collapsed: boolean
  children: ReactNode
}) {
  const phone = usePhone()
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  // Replays a press from before hydration through the button itself.
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (takeEarlyTap()) trigger.current?.click()
  }, [])
  const [collapsed, setCollapsed] = useState(startCollapsed)
  const [instant, setInstant] = useState(false)
  function toggle(fromKeyboard: boolean) {
    setInstant(fromKeyboard)
    setCollapsed(!collapsed)
    saveSidebarCollapsed(!collapsed)
  }
  // The shortcut's snap lasts two frames, past the width change, so a
  // later change animates unless it asks not to.
  useEffect(() => {
    if (!instant) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setInstant(false))
    })
    return () => cancelAnimationFrame(frame)
  }, [instant])
  return (
    <div className="sticky top-0 flex h-dvh bg-background text-foreground">
      <Sidebar aria-label="Chats" collapsed={collapsed} instant={instant}>
        <SidebarToggle
          collapsed={collapsed}
          shortcut={phone === false}
          onToggle={toggle}
        />
        <div className="px-2.5">
          <NewChatLink tooltip={collapsed} />
        </div>
        {phone === false && <ChatList chats={chats} />}
        <SidebarFooter>
          <AccountMenu account={account} tooltip={collapsed} />
        </SidebarFooter>
      </Sidebar>
      {/* Relative: a chat's title pill sits over this column's top, in the
          phone's header row (src/routes/_app/c.$id.tsx). */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <SidebarDrawer
          open={open && phone === true}
          onOpenChange={setOpen}
          onOpenChangeComplete={setOpened}
          themeColor
        >
          <header className="box-content flex h-header shrink-0 items-center px-3 pt-safe md:hidden">
            <ScriptOnce>{EARLY_TAP}</ScriptOnce>
            <SidebarDrawerTrigger id={TRIGGER_ID} ref={trigger} />
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
              <SidebarFooter>
                <AccountMenu account={account} />
              </SidebarFooter>
            </SidebarDrawerContent>
          )}
        </SidebarDrawer>
        {children}
      </div>
    </div>
  )
}

function NewChatLink({
  onClick,
  tooltip = false,
}: {
  onClick?: () => void
  /** Named in a tooltip, for the rail, where its label is hidden. */
  tooltip?: boolean
}) {
  return (
    <Tooltip disabled={!tooltip}>
      <TooltipTrigger
        render={
          <SidebarRow
            variant="raised"
            render={<Link to="/" />}
            onClick={onClick}
          />
        }
      >
        <NewChatGlyph />
        <span>New Chat</span>
      </TooltipTrigger>
      <TooltipContent side="right">New Chat</TooltipContent>
    </Tooltip>
  )
}

function ChatList({
  chats,
  limit,
  onPick,
}: {
  chats: ChatSummary[]
  /** Only the first this many (pins, then the newest), while the drawer
   *  slides. */
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
    <ScrollArea
      aria-label="Chat list"
      className="flex-1 group-data-collapsed/sidebar:hidden"
    >
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
