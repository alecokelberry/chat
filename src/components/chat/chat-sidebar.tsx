// The signed-in shell: the sidebar beside the page. From md up it's a
// column; on a phone it's a drawer from the start edge, opened from a
// header above the page, and it closes when you pick a row. It holds New
// Chat, the chat list, pinned chats first, then grouped by the browser's
// own day (src/lib/chat/groups.ts), newest first (a chat without a title
// yet shows "New chat"), and the account row at the bottom
// (account-menu.tsx). Each row has its own … menu (chat-actions.tsx), so
// each is a menu an agent can find by the row's name, and Rename edits
// that row's title in place (Escape there cancels it, leaving the drawer
// open).
//
// The list scrolls up behind New Chat (it starts --spacing-list-overlap under the button and
// fades over its top 56px, scroll-fade-y), so rows dim softly under the button's
// shadow instead of ending at a hard edge.
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
  type ReactNode,
} from "react"
import { Link, ScriptOnce, useNavigate } from "@tanstack/react-router"
import { EllipsisIcon } from "lucide-react"

import { AccountMenu, type Account } from "@/components/chat/account-menu"
import { ChatMenuContent, RenameField } from "@/components/chat/chat-actions"
import { useChatList, type ChatRef } from "@/components/chat/chat-list"
import {
  createSearchController,
  SearchButton,
  SearchDialog,
} from "@/components/chat/search"
import { BrandMark } from "@/components/ui/brand-mark"
import { Menu } from "@/components/ui/menu"
import { NewChatGlyph } from "@/components/ui/new-chat-glyph"
import { useThemeShortcut } from "@/components/ui/preferences"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  NEW_CHAT_SHORTCUT,
  Sidebar,
  SidebarDrawer,
  SidebarDrawerContent,
  SidebarDrawerTrigger,
  SidebarGroup,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarRow,
  SidebarRowAction,
  SidebarRowEdit,
  SidebarToggle,
  useNewChatShortcut,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipShortcut,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { groupChats } from "@/lib/chat/groups"
import { usePhone } from "@/lib/phone"
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

/** The row whose Pin or Unpin was just chosen. Pinning moves the row to
 *  another group, so it is built again and the … that had focus is gone:
 *  the new row's … takes focus (ChatRow). */
let movedRow: { id: string; until: number } | null = null

/** How far in from the row's end its … sits (SidebarRowAction's end-1.5),
 *  so its menu's end can line up with the row's. */
const ROW_ACTION_INSET = -6

/** More rows than the tallest phone shows: what the drawer opens with. */
const FIRST_SCREEN = 40

export function ChatSidebar({
  account,
  collapsed: startCollapsed,
  children,
}: {
  account: Account
  /** Whether the computer's column starts as a rail. */
  collapsed: boolean
  children: ReactNode
}) {
  const phone = usePhone()
  const navigate = useNavigate()
  // Navigating has no animation to skip: the page just swaps.
  useNewChatShortcut(() => void navigate({ to: "/" }))
  useThemeShortcut()
  const { chats } = useChatList()
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const [search] = useState(createSearchController)
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
        >
          <SearchButton controller={search} />
        </SidebarToggle>
        <div className="relative z-10 px-2.5">
          <NewChatLink />
        </div>
        {/* The rail has no room beside its toggle, so Search sits under
            New Chat there, level with the toggle. */}
        <div className="mt-1 hidden ps-3 group-data-collapsed/sidebar:flex">
          <SearchButton controller={search} tooltipSide="right" />
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
          onOpenChange={(next, details) => {
            // Escape in a row being renamed (SidebarRowEdit, holding
            // chat-actions.tsx's field) cancels the rename, not the drawer.
            if (
              details.reason === "escape-key" &&
              details.event?.target instanceof Element &&
              details.event.target.closest("[data-slot=sidebar-row-edit]") !==
                null
            )
              details.cancel()
            else setOpen(next)
          }}
          onOpenChangeComplete={setOpened}
          themeColor
        >
          <header className="box-content flex h-header shrink-0 items-center px-3 pt-safe md:hidden">
            <ScriptOnce>{EARLY_TAP}</ScriptOnce>
            <SidebarDrawerTrigger id={TRIGGER_ID} ref={trigger} />
            <div className="ms-1 flex">
              <SearchButton controller={search} tooltip={false} />
            </div>
          </header>
          {phone === true && (
            <SidebarDrawerContent title="Chats">
              <div className="flex h-sidebar-header shrink-0 items-center justify-between px-3">
                <BrandMark tone="icon" className="size-icon" />
                <SearchButton controller={search} tooltip={false} />
              </div>
              <SidebarHeader className="relative z-10">
                <NewChatLink onClick={close} tooltip={false} />
              </SidebarHeader>
              <ChatList
                chats={chats}
                limit={opened ? undefined : FIRST_SCREEN}
                onPick={close}
              />
              <SidebarFooter>
                <AccountMenu account={account} onOpenChat={close} />
              </SidebarFooter>
            </SidebarDrawerContent>
          )}
        </SidebarDrawer>
        {children}
      </div>
      <SearchDialog controller={search} onPick={close} />
    </div>
  )
}

function NewChatLink({
  onClick,
  tooltip = true,
}: {
  onClick?: () => void
  /** Whether to show the tooltip: the shortcut, named. The phone's drawer
   *  has none (a finger has no hover). */
  tooltip?: boolean
}) {
  return (
    <Tooltip disabled={!tooltip} shortcut={NEW_CHAT_SHORTCUT}>
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
      <TooltipContent side="right">
        New Chat
        <TooltipShortcut />
      </TooltipContent>
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
  const [renaming, setRenaming] = useState<string | null>(null)
  const listed = useMemo(
    () => (limit === undefined ? chats : chats.slice(0, limit)),
    [chats, limit]
  )
  // The list renders at low priority, so a long one never holds up a
  // streaming reply or a tap: React drops the work when something urgent
  // comes in, and starts it again after.
  const shown = useDeferredValue(listed, NO_CHATS)
  const groups = useMemo(() => groupChats(shown, Date.now()), [shown])
  const stopRenaming = useCallback(() => setRenaming(null), [])
  return (
    <ScrollArea
      aria-label="Chat list"
      fade
      className="-mt-list-overlap flex-1 fade-size-long group-data-collapsed/sidebar:hidden"
    >
      <div className="pt-list-overlap pb-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label} label={group.label}>
            {group.chats.map((chat) => (
              <ChatRow
                key={chat.id}
                id={chat.id}
                title={chat.title}
                pinned={chat.pinned}
                renaming={chat.id === renaming}
                onRename={setRenaming}
                onRenamed={stopRenaming}
                onPick={onPick}
              />
            ))}
          </SidebarGroup>
        ))}
      </div>
    </ScrollArea>
  )
}

// Takes the chat's fields rather than the chat, so a reloaded list
// re-renders only the rows that changed.
const ChatRow = memo(function ChatRow({
  id,
  title,
  pinned,
  renaming,
  onRename,
  onRenamed,
  onPick,
}: ChatRef & {
  renaming: boolean
  onRename: (id: string) => void
  onRenamed: () => void
  onPick?: () => void
}) {
  const chat = { id, title, pinned }
  const action = useRef<HTMLButtonElement>(null)
  const name = title ?? "New chat"
  useEffect(() => {
    if (movedRow?.id !== id) return
    if (Date.now() < movedRow.until) action.current?.focus()
    movedRow = null
  }, [id])
  if (renaming)
    return (
      <SidebarItem>
        <SidebarRowEdit>
          <RenameField chat={chat} onClose={onRenamed} returnFocus={action} />
        </SidebarRowEdit>
      </SidebarItem>
    )
  return (
    <SidebarItem>
      {/* No preload on hover: it would ask the server for the session once
          per row the pointer crosses. */}
      <SidebarRow
        render={<Link to="/c/$id" params={{ id }} preload={false} />}
        onClick={onPick}
      >
        <span dir="auto">{name}</span>
      </SidebarRow>
      <Menu>
        <SidebarRowAction ref={action} aria-label={`Actions for ${name}`}>
          <EllipsisIcon aria-hidden />
        </SidebarRowAction>
        {/* As wide as the row, its end on the row's: inside the column's
            margins, where 256px from the … would cross its edge. */}
        <ChatMenuContent
          chat={chat}
          className="data-[presentation=popover]:w-sidebar-row"
          alignOffset={ROW_ACTION_INSET}
          onRename={() => onRename(id)}
          onPin={() => {
            movedRow = { id, until: Date.now() + 3000 }
          }}
        />
      </Menu>
    </SidebarItem>
  )
})
