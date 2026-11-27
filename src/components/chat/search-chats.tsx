// Search's dialog and list (search.tsx opens it; this loads apart so the
// first load doesn't carry it). The list is ui-sdk's Command over the chat list the layout
// already has (chat-list.tsx), no server call. With nothing typed it lists
// the 50 most recent (pins, then the newest) in the sidebar's groups
// (src/lib/chat/groups.ts); typing ranks every chat by title with
// Command's fuzzy filter, best first, matched letters in bold, rendering
// only the rows in view. Each result is a link to its chat, so Enter, a
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
  CommandItemText,
  CommandList,
  CommandWindow,
  useCommandWindow,
  type CommandData,
  type CommandDataItem,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  type DialogController,
} from "@/components/ui/dialog"
import { groupChats } from "@/lib/chat/groups"
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

function SearchChats({ close }: { close: () => void }) {
  const { chats } = useChatList()
  const navigate = useNavigate()
  const items = useMemo(() => chats.map(toItem), [chats])
  const groups = useMemo<CommandData>(
    () =>
      groupChats(chats.slice(0, RECENT), Date.now()).map((group) => ({
        type: "group",
        label: group.label,
        items: group.chats.map(toItem),
      })),
    [chats]
  )
  // Typed: one ranked list, as long as every chat, so only the rows in
  // view render. Empty: the recent ones, in groups, all rendered.
  const [typed, setTyped] = useState(false)
  const { list, view, reveal } = useCommandWindow()
  return (
    <Command
      items={items}
      emptyItems={groups}
      autoHighlight
      onAction={(id, { event }) => {
        // A click, a tap or Enter follows the result's link itself; a run
        // with neither (an agent's) goes there from here.
        if (!(event instanceof MouseEvent || event instanceof KeyboardEvent))
          void navigate({ to: "/c/$id", params: { id } })
        close()
      }}
      onQueryChange={(query) => setTyped(query.trim() !== "")}
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
          state.empty ? `No chats match “${state.query.trim()}”` : null
        }
      </CommandEmpty>
      <CommandList ref={list}>
        {(state) =>
          typed ? (
            <CommandWindow items={state.items.filter(isCommand)} view={view}>
              {(item, index) => <Result item={item} index={index} />}
            </CommandWindow>
          ) : (
            <Groups items={state.items} />
          )
        }
      </CommandList>
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

/** A chat: a link to it, its title's matched letters in bold. `index` is
 *  its place in a window's ranked results. */
function Result({ item, index }: { item: CommandDataItem; index?: number }) {
  return (
    <CommandItem
      value={item.value}
      label={item.label}
      index={index}
      render={<Link to="/c/$id" params={{ id: item.value }} preload={false} />}
    >
      <CommandItemText />
    </CommandItem>
  )
}
