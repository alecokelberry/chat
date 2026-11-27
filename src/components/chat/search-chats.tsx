// Search's dialog and list (search.tsx opens it; this loads apart so the
// first load doesn't carry it). The list is ui-sdk's Command over the chat list the layout
// already has (chat-list.tsx). With nothing typed it lists
// the 50 most recent (pins, then the newest) in the sidebar's groups
// (src/lib/chat/groups.ts); typing ranks every chat by title with
// Command's fuzzy filter, best first, matched letters in bold, rendering
// only the rows in view. From two letters, as typing pauses, chats whose
// messages hold the words (src/lib/chat/message-index.ts) follow under
// Messages, each with its matching line; title matches stay put while they
// load, and a failure says so quietly under the list. Each result is a link to its chat, so Enter, a
// click or a tap opens it (and a middle-click opens a tab); an agent's run
// goes there too. Opening one closes Search, and so does Escape, at once,
// even with text typed.
import { useMemo, useState, type RefObject } from "react"
import { Link, useNavigate } from "@tanstack/react-router"

import { useChatList } from "@/components/chat/chat-list"
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
import { groupChats } from "@/lib/chat/groups"
import { findInMessages, QUERY_MAX } from "@/lib/chat/list"
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
      <DialogContent ref={content}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <SearchChats close={() => controller.close()} />
      </DialogContent>
    </Dialog>
  )
}

/** Message matches' values: the chat's id after this, apart from its
 *  title row's. */
const WORDS = "words:"

/** A message match, ready to show: its chat's title and its line. */
type WordsItem = CommandDataItem & { line: MatchSegment[] }

function SearchChats({ close }: { close: () => void }) {
  const { chats } = useChatList()
  const navigate = useNavigate()
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
      onAction={(value, { event }) => {
        // A click, a tap or Enter follows the result's link itself; a run
        // with neither (an agent's) goes there from here.
        const id = value.startsWith(WORDS) ? value.slice(WORDS.length) : value
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
      <CommandInput
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
      <CommandEmpty>
        {(state) =>
          state.empty && !state.loading
            ? `No chats match “${state.query.trim()}”`
            : null
        }
      </CommandEmpty>
      <CommandList ref={list}>
        {(state) => {
          if (!typed) return <Groups items={state.items} />
          const shown = state.items.filter(isCommand)
          const titles = shown.filter((item) => !item.value.startsWith(WORDS))
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
          state.status === "error" ? "Couldn’t search messages just now" : null
        }
      </CommandStatus>
    </Command>
  )
}

const isCommand = (entry: CommandData[number]): entry is CommandDataItem =>
  typeof entry !== "string" && !("type" in entry)

/** The recent chats in their groups, while nothing is typed. */
function Groups({ items }: { items: CommandData }) {
  return items.map((entry) =>
    typeof entry !== "string" && "type" in entry && entry.type === "group" ? (
      <CommandGroup key={entry.label}>
        <CommandGroupLabel>{entry.label}</CommandGroupLabel>
        {entry.items.filter(isCommand).map((item) => (
          <Result key={item.value} item={item} />
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
    <CommandItem
      value={item.value}
      label={item.label}
      index={index}
      render={<Link to="/c/$id" params={{ id: item.value }} preload={false} />}
    >
      {query === undefined ? (
        <CommandItemText />
      ) : (
        <CommandMatchText text={item.label} query={query} />
      )}
    </CommandItem>
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
    <CommandItem
      value={item.value}
      label={item.label}
      index={index}
      render={<Link to="/c/$id" params={{ id }} preload={false} />}
    >
      <CommandItemLines label={item.label} line={line} />
    </CommandItem>
  )
}
