// Search's dialog and list (search.tsx opens it; this loads apart so the
// first load doesn't carry it): Grok's command palette, "Search or type an
// action". The list is ui-sdk's Command over Chat's actions (New Chat, its
// keys on the right) and the chat list the layout already has
// (chat-list.tsx). The actions are New Chat, Change theme, Open settings,
// Feature tour, Toggle sidebar (not on a phone, which has a drawer) and Sign
// out; the first is a link, the rest run from onAction. With nothing
// typed it shows the actions, New Chat highlighted, then under Chats the 50 most recently active, each with a
// chat icon and how long ago on the right (1d, 2d). Tab moves the
// highlight to the next section's first row, Shift+Tab back. Typing ranks
// the actions and every chat by title with Command's fuzzy filter, a
// matching action first, then the best titles, matched letters in bold,
// rendering only the rows in view. From two letters, as typing pauses, chats whose
// messages hold the words (src/lib/chat/message-index.ts) follow under
// Messages, each with its matching line; title matches stay put while they
// load, and a failure says so quietly under the list. Each open also has
// a few chats from before the index index themselves (indexOlderChats).
// Each result is a link to its chat, so Enter, a click or a tap opens it
// (and a middle-click opens a tab); an agent's run goes there too. Opening
// one closes Search, and so does Escape, at once, even with text typed.
//
// From md the dialog widens and previews the highlighted chat beside the
// list (SearchPreview): its messages, read-only, loaded from its agent once
// the highlight rests, the last one shown until the next arrives, so the
// arrow keys don't flicker it. Each result has the sidebar's … beside it
// (chat-actions.tsx): Pin, Rename (in the search field's place, since the
// list may hold only options, as its menu renders outside it), Open in new
// tab and Delete (the same Undo toast). Search's rows come from the same list,
// so a rename or delete shows in both at once.
import {
  createContext,
  type ComponentType,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import type { UIMessage } from "ai"
import {
  CompassIcon,
  EllipsisIcon,
  LogOutIcon,
  MessageCircleIcon,
  PanelLeftIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react"
import { Link, useNavigate } from "@tanstack/react-router"

import { ChatMenuContent, RenameField } from "@/components/chat/chat-actions"
import type { SettingsController } from "@/components/chat/settings-dialog"
import { useChatList } from "@/components/chat/chat-list"
import { ThreadPreview } from "@/components/chat/thread"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemEnd,
  CommandItemLines,
  CommandItemText,
  CommandList,
  CommandMatchText,
  CommandPreview,
  CommandRow,
  CommandRowAction,
  CommandFieldEdit,
  CommandStatus,
  CommandWindow,
  createCommandController,
  fuzzyScore,
  fuzzyThen,
  useAsyncOptions,
  useCommandWindow,
  type CommandData,
  type CommandDataItem,
  type MatchSegment,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  type DialogController,
} from "@/components/ui/dialog"
import { Kbd, KbdKeys } from "@/components/ui/kbd"
import { Menu } from "@/components/ui/menu"
import { useToggleTheme } from "@/components/ui/preferences"
import {
  NEW_CHAT_SHORTCUT,
  TOGGLE_SIDEBAR_SHORTCUT,
} from "@/components/ui/sidebar"
import { ThemeIcon } from "@/components/ui/theme-icon"
import { toast } from "@/components/ui/toast"
import { SIGN_OUT_CONFIRM, useSignOut } from "@/lib/auth/use-sign-out"
import { findInMessages, indexOlderChats, QUERY_MAX } from "@/lib/chat/list"
import { useOpenTour } from "@/lib/chat/use-open-tour"
import { sortChats } from "@/lib/chat/groups"
import { marksOf } from "@/lib/chat/match-marks"
import { nextSection } from "@/lib/chat/next-section"
import { relativeTime } from "@/lib/chat/relative-time"
import type { ChatSummary } from "@/lib/chat/store"
import { usePhone } from "@/lib/phone"

const toItem = (chat: ChatSummary): CommandDataItem => ({
  value: chat.id,
  label: chat.title ?? "New chat",
})

/** The most chats listed while nothing is typed: the most recently active. */
const RECENT = 50

/** The theme's sun and moon at a row's icon size; the row would stretch
 *  its span (a row's own spans fill the rest of it). */
const ThemeActionIcon = () => (
  <ThemeIcon className="flex-none! [&_svg]:size-4.5" />
)

/** What Search can do besides opening a chat, first in the list, with
 *  its keys. New Chat goes to `to`, as a link; the others run from
 *  onAction (runAction). Toggle sidebar is for computers only: a phone
 *  has the drawer. */
const ACTIONS: readonly {
  value: string
  label: string
  to?: "/"
  shortcut?: string
  icon: ComponentType<{ "aria-hidden"?: boolean }>
  computerOnly?: true
  /** What an agent is told before it runs this. */
  confirm?: string
}[] = [
  {
    value: "action:new-chat",
    label: "New Chat",
    to: "/",
    shortcut: NEW_CHAT_SHORTCUT,
    icon: PlusIcon,
  },
  {
    value: "action:theme",
    label: "Change theme",
    shortcut: "d",
    icon: ThemeActionIcon,
  },
  {
    value: "action:settings",
    label: "Open settings",
    icon: SettingsIcon,
  },
  {
    value: "action:tour",
    label: "Feature tour",
    icon: CompassIcon,
  },
  {
    value: "action:sidebar",
    label: "Toggle sidebar",
    shortcut: TOGGLE_SIDEBAR_SHORTCUT,
    icon: PanelLeftIcon,
    computerOnly: true,
  },
  {
    value: "action:sign-out",
    label: "Sign out",
    icon: LogOutIcon,
    confirm: SIGN_OUT_CONFIRM,
  },
]

type Action = (typeof ACTIONS)[number]

const actionOf = (value: string): Action | undefined =>
  ACTIONS.find((action) => action.value === value)

const ACTION_VALUES: ReadonlySet<string> = new Set(
  ACTIONS.map((action) => action.value)
)

/** What the shell gives Search for the actions that aren't links. */
export type ActionTools = {
  settings: SettingsController
  /** Collapses or expands the computer's sidebar. */
  toggleSidebar: () => void
}

/** The dialog `controller` opens, `content` its panel, for ⌘K to close
 *  it from inside. */
export function SearchPanel({
  controller,
  content,
  onPick,
  tools,
}: {
  controller: DialogController
  content: RefObject<HTMLDivElement | null>
  /** A chat was picked: the phone's drawer under Search closes too. */
  onPick?: () => void
  tools: ActionTools
}) {
  // While the sheet slides up and the keyboard rises under it, iOS draws
  // the field's caret where the field was, not where it is, so it jumped
  // on Alec's iPhone: it shows once both have settled. Focus still comes
  // at once, to raise the keyboard.
  const [settled, setSettled] = useState(false)
  return (
    <Dialog
      controller={controller}
      onOpenChangeComplete={(open) => {
        if (!open) return setSettled(false)
        // Unless it closed again in the meantime.
        void viewportSettled().then(() => setSettled(controller.isOpen()))
      }}
    >
      <DialogContent ref={content} wide>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <SearchChats
          close={() => controller.close()}
          onPick={onPick}
          tools={tools}
          settled={settled}
        />
      </DialogContent>
    </Dialog>
  )
}

/** Resolves once the visual viewport has stopped resizing (the phone's
 *  keyboard has finished rising) for 120 ms, or after 800 ms at most. */
function viewportSettled() {
  return new Promise<void>((resolve) => {
    const viewport = window.visualViewport
    let quiet = 0
    const done = () => {
      clearTimeout(quiet)
      clearTimeout(cap)
      viewport?.removeEventListener("resize", wait)
      resolve()
    }
    const wait = () => {
      clearTimeout(quiet)
      quiet = window.setTimeout(done, 120)
    }
    const cap = window.setTimeout(done, 800)
    viewport?.addEventListener("resize", wait)
    wait()
  })
}

/** Message matches' values: the chat's id after this, apart from its
 *  title row's. */
const WORDS = "words:"

/** The chat a result's value names. */
const chatIdOf = (value: string) =>
  value.startsWith(WORDS) ? value.slice(WORDS.length) : value

/** What a result's row needs for its actions: the chats by id, and how
 *  to start renaming one. Focus goes back to the field after. */
type RowState = {
  chats: ReadonlyMap<string, ChatSummary>
  setRenaming: (id: string | null) => void
  field: RefObject<HTMLInputElement | null>
  /** Where a row's menu renders: in the dialog, outside the listbox,
   *  which may hold only options. */
  menus: HTMLElement | null
  /** Shows a chat in the preview. */
  preview: (id: string) => void
}

const RowContext = createContext<RowState | null>(null)

/** While its row is highlighted, shows chat `id` in the preview. */
function Previewed({ id }: { id: string }) {
  const state = use(RowContext)
  useEffect(() => state?.preview(id), [state, id])
  return null
}

/** A result `option` with its … beside it. */
function ChatRow({ id, children }: { id: string; children: ReactNode }) {
  const state = use(RowContext)
  const chat = state?.chats.get(id)
  if (state === null || chat === undefined) return children
  return (
    <CommandRow>
      {children}
      <Menu>
        <CommandRowAction
          aria-label={`Actions for ${chat.title ?? "New chat"}`}
        >
          <EllipsisIcon aria-hidden />
        </CommandRowAction>
        <ChatMenuContent
          chat={chat}
          onRename={() => state.setRenaming(id)}
          deletedFocus={() => state.field.current}
          container={state.menus}
        />
      </Menu>
    </CommandRow>
  )
}

/** How long the highlight rests on a chat before its preview loads. */
const PREVIEW_AFTER = 120

/** The highlighted chat's messages, read-only, from md. The last chat's
 *  stay until the next one's arrive; one that fails to load says so. */
function SearchPreview({ id }: { id: string | null }) {
  const { chats } = useChatList()
  const cache = useRef(new Map<string, UIMessage[]>())
  const [shown, setShown] = useState<{
    id: string
    messages: UIMessage[] | null
  } | null>(null)
  useEffect(() => {
    if (id === null) return
    const cached = cache.current.get(id)
    if (cached !== undefined) {
      setShown({ id, messages: cached })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/chats/${id}/get-messages`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`${response.status}`)
          const messages: UIMessage[] = await response.json()
          cache.current.set(id, messages)
          setShown({ id, messages })
        })
        .catch(() => {
          if (!controller.signal.aborted) setShown({ id, messages: null })
        })
    }, PREVIEW_AFTER)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [id])
  const title = chats.find((chat) => chat.id === shown?.id)?.title
  return (
    <CommandPreview aria-label="Preview">
      {shown !== null &&
        (shown.messages === null ? (
          <p className="text-sm text-muted-foreground">
            Couldn’t load this chat
          </p>
        ) : shown.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {title ?? "New chat"} has no messages yet
          </p>
        ) : (
          <ThreadPreview messages={shown.messages} />
        ))}
    </CommandPreview>
  )
}

/** A message match, ready to show: its chat's title and its line. */
type WordsItem = CommandDataItem & { line: MatchSegment[] }

function SearchChats({
  close,
  onPick,
  tools,
  settled,
}: {
  close: () => void
  onPick?: () => void
  tools: ActionTools
  /** The sheet has finished sliding in: the caret can show. */
  settled: boolean
}) {
  const { chats } = useChatList()
  const navigate = useNavigate()
  const field = useRef<HTMLInputElement>(null)
  const [command] = useState(createCommandController)
  // The rows' values, section by section, as last rendered: what Tab
  // moves between.
  const sections = useRef<string[][]>([])
  // Each row says when it's highlighted (Previewed): ui-sdk places some
  // highlights without onValueChange, like one on a match that arrives.
  const [highlighted, setHighlighted] = useState<string | null>(null)
  // The dialog first renders its content before it's in the page, and
  // rows bound there never highlight once moved in (no highlight, hover or
  // Enter until typing), so the recent rows wait for the first commit.
  const [mounted, setMounted] = useState(false)
  // oxlint-disable-next-line react/set-state-in-effect -- the rows must bind after the dialog is in the page
  useEffect(() => setMounted(true), [])
  const [renaming, setRenaming] = useState<string | null>(null)
  const renamed = chats.find((chat) => chat.id === renaming)
  const phone = usePhone()
  const openTour = useOpenTour(onPick)
  const toggleTheme = useToggleTheme()
  const signOut = useSignOut()
  const actionItems = useMemo<CommandDataItem[]>(
    () =>
      ACTIONS.filter((action) => !(action.computerOnly && phone === true)).map(
        ({ value, label }) => ({ value, label })
      ),
    [phone]
  )
  /** Runs an action that isn't a link. The ones that open something over
   *  the page (Settings) or leave it (Sign out) keep a phone's drawer;
   *  the tour, like a chat, closes it. */
  function runAction(value: string) {
    switch (value) {
      case "action:theme":
        return toggleTheme()
      case "action:settings":
        return void tools.settings.open({ payload: "account" })
      case "action:sidebar":
        return tools.toggleSidebar()
      case "action:sign-out":
        return void signOut().catch(() => toast.error("Couldn't sign out"))
      case "action:tour":
        return void openTour()
    }
  }
  const [menus, setMenus] = useState<HTMLDivElement | null>(null)
  const rows = useMemo(
    () => ({
      chats: new Map(chats.map((chat) => [chat.id, chat])),
      setRenaming,
      field,
      menus,
      preview: setHighlighted,
    }),
    [chats, menus]
  )
  const groups = useMemo<CommandData>(
    () => [
      { type: "group", label: "Actions", items: actionItems },
      {
        type: "group",
        label: "Chats",
        // Pins first, as in the sidebar, then the most recently active.
        items: sortChats(chats, "updatedAt").slice(0, RECENT).map(toItem),
      },
    ],
    [actionItems, chats]
  )
  // Typed: titles ranked in one list, as long as every chat, so only the
  // rows in view render; then message matches, from two letters, as
  // typing pauses. Empty: the recent ones, in groups, all rendered.
  const [query, setQuery] = useState("")
  const typed = query.trim() !== ""
  const found = useAsyncOptions(
    (text: string, { signal }: { signal: AbortSignal }) =>
      findInMessages({ data: { query: text.slice(0, QUERY_MAX) }, signal }),
    { minLength: 2 }
  )
  const { list, view, reveal } = useCommandWindow()
  // Each open has a few chats from before the index index themselves;
  // words already typed are searched again once they have.
  const typedRef = useRef(query)
  typedRef.current = query
  const { reload } = found
  useEffect(() => {
    void indexOlderChats().then(
      () => {
        if (typedRef.current.trim().length >= 2) reload()
      },
      () => undefined
    )
  }, [reload])
  // A chat a title already matches isn't repeated; nor is one the list no
  // longer has (deleted since, or not in ?data=worst's made-up list).
  const words = useMemo<WordsItem[]>(() => {
    const titles = new Map(chats.map((chat) => [chat.id, toItem(chat).label]))
    return found.items.flatMap(({ id, snippet }) => {
      const label = titles.get(id)
      if (label === undefined || fuzzyScore(label, query) > 0) return []
      return [{ value: WORDS + id, label, line: marksOf(snippet) }]
    })
  }, [chats, found.items, query])
  const items = useMemo(
    () => [...actionItems, ...chats.map(toItem), ...words],
    [actionItems, chats, words]
  )
  const filter = useMemo(
    () =>
      fuzzyThen(
        words.map((item) => item.value),
        ACTION_VALUES
      ),
    [words]
  )
  /** Tab: the next section's first row (Shift+Tab, the one before). */
  const toSection = (step: 1 | -1) => {
    const next = nextSection(sections.current, command.getValue(), step)
    if (next !== undefined) command.setValue(next)
  }
  return (
    <Command
      items={items}
      emptyItems={groups}
      filter={filter}
      status={found.status}
      controller={command}
      autoHighlight
      defaultValue="action:new-chat"
      onAction={(value, { event }) => {
        const action = actionOf(value)
        if (action !== undefined && action.to === undefined) {
          runAction(value)
          close()
          return
        }
        // A click, a tap or Enter follows the result's link itself; a run
        // with neither (an agent's) goes there from here.
        if (!(event instanceof MouseEvent || event instanceof KeyboardEvent)) {
          void (action?.to === undefined
            ? navigate({ to: "/c/$id", params: { id: chatIdOf(value) } })
            : navigate({ to: action.to }))
        }
        onPick?.()
        close()
      }}
      onQueryChange={(next) => {
        setQuery(next)
        found.setQuery(next.trim())
      }}
      onValueChange={(_, { index }) => {
        if (typed) reveal(index)
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {renamed !== undefined && (
        <CommandFieldEdit icon={<PencilIcon aria-hidden />}>
          <RenameField
            chat={renamed}
            onClose={() => setRenaming(null)}
            returnFocus={field}
          />
        </CommandFieldEdit>
      )}
      <CommandInput
        ref={field}
        caretHidden={!settled}
        hidden={renamed !== undefined}
        aria-label="Search chats and actions"
        placeholder="Search or type an action"
        hint={
          <>
            Next section <Kbd>Tab</Kbd>
          </>
        }
        onKeyDown={(event) => {
          // At once, not after clearing the text first.
          if (event.key === "Escape") {
            event.preventDefault()
            close()
          }
          if (event.key === "Tab" && !event.altKey && !event.metaKey) {
            event.preventDefault()
            toSection(event.shiftKey ? -1 : 1)
          }
        }}
      />
      <RowContext value={rows}>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 w-full flex-col md:w-dialog-list md:shrink-0">
            <CommandEmpty>
              {(state) =>
                state.empty && !state.loading
                  ? `No chats match “${state.query.trim()}”`
                  : null
              }
            </CommandEmpty>
            <CommandList ref={list}>
              {(state) => {
                if (!typed) {
                  sections.current = state.items.map((entry) =>
                    isGroup(entry)
                      ? entry.items.filter(isCommand).map((item) => item.value)
                      : []
                  )
                  return mounted ? <Groups items={state.items} /> : null
                }
                const shown = state.items.filter(isCommand)
                const titles = shown.filter(
                  (item) => !item.value.startsWith(WORDS)
                )
                const matches = shown.slice(titles.length)
                const values = (list: CommandDataItem[]) =>
                  list.map((item) => item.value)
                sections.current = [
                  values(
                    titles.filter((item) => ACTION_VALUES.has(item.value))
                  ),
                  values(
                    titles.filter((item) => !ACTION_VALUES.has(item.value))
                  ),
                  values(matches),
                ]
                return (
                  <>
                    <CommandWindow items={titles} view={view}>
                      {(item, index) =>
                        ACTION_VALUES.has(item.value) ? (
                          <ActionResult
                            item={item}
                            index={index}
                            query={query}
                          />
                        ) : (
                          <Result item={item} index={index} query={query} />
                        )
                      }
                    </CommandWindow>
                    {matches.length > 0 && (
                      <CommandGroup>
                        <CommandGroupLabel>Messages</CommandGroupLabel>
                        {matches.map((item, offset) => (
                          <WordsResult
                            key={item.value}
                            item={item}
                            index={titles.length + offset}
                            line={
                              words.find((match) => match.value === item.value)
                                ?.line ?? []
                            }
                          />
                        ))}
                      </CommandGroup>
                    )}
                  </>
                )
              }}
            </CommandList>
            <CommandStatus>
              {(state) =>
                state.status === "error"
                  ? "Couldn’t search messages just now"
                  : null
              }
            </CommandStatus>
          </div>
          {/* Not on a phone, where nothing would show it. */}
          {phone === false && <SearchPreview id={highlighted} />}
        </div>
        <div ref={setMenus} />
      </RowContext>
    </Command>
  )
}

const isCommand = (entry: CommandData[number]): entry is CommandDataItem =>
  typeof entry !== "string" && !("type" in entry)

const isGroup = (
  entry: CommandData[number]
): entry is Extract<CommandData[number], { type: "group" }> =>
  typeof entry !== "string" && "type" in entry && entry.type === "group"

/** The actions, then the recent chats under Chats, while nothing is
 *  typed. The actions' label is for screen readers: Grok shows none. */
function Groups({ items }: { items: CommandData }) {
  let index = 0
  return items.map((entry) =>
    isGroup(entry) ? (
      <CommandGroup key={entry.label}>
        <CommandGroupLabel
          className={entry.label === "Actions" ? "sr-only" : undefined}
        >
          {entry.label}
        </CommandGroupLabel>
        {entry.items
          .filter(isCommand)
          .map((item) =>
            ACTION_VALUES.has(item.value) ? (
              <ActionResult key={item.value} item={item} index={index++} />
            ) : (
              <Result key={item.value} item={item} index={index++} />
            )
          )}
      </CommandGroup>
    ) : null
  )
}

/** An action: a link to where it goes, its icon, its label (matched
 *  letters in bold while typed) and its keys on the right. */
function ActionResult({
  item,
  index,
  query,
}: {
  item: CommandDataItem
  index?: number
  query?: string
}) {
  const action = actionOf(item.value)
  if (action === undefined) return null
  const Icon = action.icon
  return (
    <CommandItem
      value={item.value}
      label={item.label}
      index={index}
      render={action.to === undefined ? undefined : <Link to={action.to} />}
      data-agent-confirm={action.confirm}
    >
      <Icon aria-hidden />
      {query === undefined ? (
        <CommandItemText />
      ) : (
        <CommandMatchText text={item.label} query={query} />
      )}
      {action.shortcut !== undefined && (
        <KbdKeys shortcut={action.shortcut} className="ms-3 flex-none!" />
      )}
    </CommandItem>
  )
}

/** A chat: a link to it, its title's matched letters in bold (`query`
 *  while typed). `index` is its place in the ranked results. */
function Result({
  item,
  index,
  query,
}: {
  item: CommandDataItem
  index?: number
  query?: string
}) {
  const state = use(RowContext)
  const updatedAt = state?.chats.get(item.value)?.updatedAt
  return (
    <ChatRow id={item.value}>
      <CommandItem
        value={item.value}
        label={item.label}
        index={index}
        render={
          <Link to="/c/$id" params={{ id: item.value }} preload={false} />
        }
      >
        {(row) => (
          <>
            {row.highlighted && <Previewed id={item.value} />}
            <MessageCircleIcon aria-hidden />
            {query === undefined ? (
              <CommandItemText />
            ) : (
              <CommandMatchText text={item.label} query={query} />
            )}
            {updatedAt !== undefined && (
              <CommandItemEnd>
                {relativeTime(updatedAt, Date.now())}
              </CommandItemEnd>
            )}
          </>
        )}
      </CommandItem>
    </ChatRow>
  )
}

/** A chat its messages matched: a link to it, its title, and under it
 *  the matching line, the words in bold. */
function WordsResult({
  item,
  index,
  line,
}: {
  item: CommandDataItem
  index: number
  line: readonly MatchSegment[]
}) {
  const id = item.value.slice(WORDS.length)
  return (
    <ChatRow id={id}>
      <CommandItem
        value={item.value}
        label={item.label}
        index={index}
        render={<Link to="/c/$id" params={{ id }} preload={false} />}
      >
        {(state) => (
          <>
            {state.highlighted && <Previewed id={id} />}
            <MessageCircleIcon aria-hidden />
            <CommandItemLines label={item.label} line={line} />
          </>
        )}
      </CommandItem>
    </ChatRow>
  )
}
