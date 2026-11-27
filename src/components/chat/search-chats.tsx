// Search's dialog and list (search.tsx opens it; this loads apart so the
// first load doesn't carry it). The list is ui-sdk's Command over the chat
// list the layout already has (chat-list.tsx). With nothing typed it lists
// the 50 most recent (pins, then the newest) in the sidebar's groups
// (src/lib/chat/groups.ts); typing ranks every chat by title with
// Command's fuzzy filter, best first, matched letters in bold, rendering
// only the rows in view. From two letters, as typing pauses, chats whose
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
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import type { UIMessage } from "ai"
import { EllipsisIcon, PencilIcon } from "lucide-react"
import { Link, useNavigate } from "@tanstack/react-router"

import { ChatMenuContent, RenameField } from "@/components/chat/chat-actions"
import { useChatList } from "@/components/chat/chat-list"
import { ThreadPreview } from "@/components/chat/thread"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
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
import { Menu } from "@/components/ui/menu"
import { groupChats } from "@/lib/chat/groups"
import { findInMessages, indexOlderChats, QUERY_MAX } from "@/lib/chat/list"
import { marksOf } from "@/lib/chat/match-marks"
import type { ChatSummary } from "@/lib/chat/store"

const toItem = (chat: ChatSummary): CommandDataItem => ({
  value: chat.id,
  label: chat.title ?? "New chat",
})

/** The most chats listed while nothing is typed: pins, then the newest. */
const RECENT = 50

/** The dialog `controller` opens, `content` its panel, for ⌘K to close
 *  it from inside. */
export function SearchPanel({
  controller,
  content,
}: {
  controller: DialogController
  content: RefObject<HTMLDivElement | null>
}) {
  return (
    <Dialog controller={controller}>
      <DialogContent ref={content} wide>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <SearchChats close={() => controller.close()} />
      </DialogContent>
    </Dialog>
  )
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
const Rows = RowContext

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

function SearchChats({ close }: { close: () => void }) {
  const { chats } = useChatList()
  const navigate = useNavigate()
  const field = useRef<HTMLInputElement>(null)
  // The first recent chat opens highlighted, so Enter opens it and the
  // preview has one to show at once.
  const [first] = useState(() => {
    const latest = groupChats(chats.slice(0, RECENT), Date.now())[0]
    return latest?.chats[0]?.id ?? null
  })
  // Each row says when it's highlighted (Previewed): ui-sdk places some
  // highlights without onValueChange, like one on a match that arrives.
  const [highlighted, setHighlighted] = useState<string | null>(first)
  // The dialog first renders its content before it's in the page, and
  // rows bound there never highlight once moved in (no highlight, hover or
  // Enter until typing), so the recent rows wait for the first commit.
  const [mounted, setMounted] = useState(false)
  // oxlint-disable-next-line react/set-state-in-effect -- the rows must bind after the dialog is in the page
  useEffect(() => setMounted(true), [])
  const [renaming, setRenaming] = useState<string | null>(null)
  const renamed = chats.find((chat) => chat.id === renaming)
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
    () =>
      groupChats(chats.slice(0, RECENT), Date.now()).map((group) => ({
        type: "group",
        label: group.label,
        items: group.chats.map(toItem),
      })),
    [chats]
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
  const items = useMemo(() => [...chats.map(toItem), ...words], [chats, words])
  const filter = useMemo(
    () => fuzzyThen(words.map((item) => item.value)),
    [words]
  )
  return (
    <Command
      items={items}
      emptyItems={groups}
      filter={filter}
      status={found.status}
      autoHighlight
      defaultValue={first}
      onAction={(value, { event }) => {
        // A click, a tap or Enter follows the result's link itself; a run
        // with neither (an agent's) goes there from here.
        const id = chatIdOf(value)
        if (!(event instanceof MouseEvent || event instanceof KeyboardEvent))
          void navigate({ to: "/c/$id", params: { id } })
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
        hidden={renamed !== undefined}
        aria-label="Search chats"
        placeholder="Search chats…"
        onKeyDown={(event) => {
          // At once, not after clearing the text first.
          if (event.key === "Escape") {
            event.preventDefault()
            close()
          }
        }}
      />
      <Rows value={rows}>
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
                if (!typed)
                  return mounted ? <Groups items={state.items} /> : null
                const shown = state.items.filter(isCommand)
                const titles = shown.filter(
                  (item) => !item.value.startsWith(WORDS)
                )
                const matches = shown.slice(titles.length)
                return (
                  <>
                    <CommandWindow items={titles} view={view}>
                      {(item, index) => (
                        <Result item={item} index={index} query={query} />
                      )}
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
          <SearchPreview id={highlighted} />
        </div>
        <div ref={setMenus} />
      </Rows>
    </Command>
  )
}

const isCommand = (entry: CommandData[number]): entry is CommandDataItem =>
  typeof entry !== "string" && !("type" in entry)

/** The recent chats in their groups, while nothing is typed. */
function Groups({ items }: { items: CommandData }) {
  let index = 0
  return items.map((entry) =>
    typeof entry !== "string" && "type" in entry && entry.type === "group" ? (
      <CommandGroup key={entry.label}>
        <CommandGroupLabel>{entry.label}</CommandGroupLabel>
        {entry.items.filter(isCommand).map((item) => (
          <Result key={item.value} item={item} index={index++} />
        ))}
      </CommandGroup>
    ) : null
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
        {(state) => (
          <>
            {state.highlighted && <Previewed id={item.value} />}
            {query === undefined ? (
              <CommandItemText />
            ) : (
              <CommandMatchText text={item.label} query={query} />
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
            <CommandItemLines label={item.label} line={line} />
          </>
        )}
      </CommandItem>
    </ChatRow>
  )
}
