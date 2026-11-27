// A chat's actions, the archived Chat's (Grok's), in each sidebar row's …
// menu, each Search result's … and the open chat's header …: Pin or Unpin, Rename, then Open in
// new tab (a real link, so it opens the way the browser opens links),
// then Delete, in red, which an agent can't press (data-agent-confirm).
//
// Pin, Rename and Delete go through the chat list (chat-list.tsx), which
// shows them at once and saves them; Delete offers Undo first.
//
// RenameField is the title being renamed, in a row or the header's pill:
// it opens focused with the title selected; Enter (Done on a phone's
// keyboard), ✓ or leaving saves, Escape or ✕ cancels, and focus goes back
// to the … that opened it. A blank or unchanged title saves nothing.
import { useEffect, useRef, type RefObject } from "react"
import { Link } from "@tanstack/react-router"
import {
  ExternalLinkIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
} from "lucide-react"

import { useChatList, type ChatRef } from "@/components/chat/chat-list"
import { EditActions } from "@/components/ui/edit-actions"
import { Input } from "@/components/ui/input"
import {
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
} from "@/components/ui/menu"
import { TITLE_MAX } from "@/lib/chat/list"

/** The menu's items for `chat`, below its trigger with their end edges
 *  level. */
export function ChatMenuContent({
  chat,
  onRename,
  onPin,
  deletedFocus = () => document.getElementById("main"),
  container,
  className,
  alignOffset,
}: {
  chat: ChatRef
  onRename: () => void
  /** Called as Pin or Unpin is chosen. */
  onPin?: () => void
  /** Where focus goes once Delete takes the … away: the page, or
   *  Search's field. */
  deletedFocus?: () => HTMLElement | null
  /** Where the menu renders, if not in place: Search's, outside its list. */
  container?: Element | null
  className?: string
  /** How far past the trigger's end the menu's end sits. */
  alignOffset?: number
}) {
  const list = useChatList()
  // Delete takes the …  away with its row (or header), so focus goes to
  // the page instead; the rest return it to the ….
  const deleting = useRef(false)
  return (
    <MenuContent
      align="end"
      alignOffset={alignOffset}
      side="bottom"
      className={className}
      finalFocus={() => (deleting.current ? deletedFocus() : null)}
      container={container}
    >
      <MenuGroup>
        <MenuItem
          onSelect={() => {
            onPin?.()
            list.pin(chat, !chat.pinned)
          }}
        >
          {chat.pinned ? <PinOffIcon aria-hidden /> : <PinIcon aria-hidden />}
          {chat.pinned ? "Unpin" : "Pin"}
        </MenuItem>
        <MenuItem onSelect={onRename}>
          <PencilIcon aria-hidden />
          Rename
        </MenuItem>
      </MenuGroup>
      <MenuSeparator />
      <MenuItem
        render={
          <Link
            to="/c/$id"
            params={{ id: chat.id }}
            target="_blank"
            rel="noopener"
          />
        }
      >
        <ExternalLinkIcon aria-hidden />
        Open in new tab
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        destructive
        data-agent-confirm="Delete this chat"
        onSelect={() => {
          deleting.current = true
          list.delete(chat)
        }}
      >
        <Trash2Icon aria-hidden />
        Delete
      </MenuItem>
    </MenuContent>
  )
}

/** The title being renamed: place it in a SidebarRowEdit, a
 *  HeaderTitleEdit or a CommandFieldEdit. It saves through the list and calls `onClose`; if
 *  focus was in the field, it goes back to `returnFocus` (the … that
 *  opened it), not to the page. */
export function RenameField({
  chat,
  onClose,
  returnFocus,
}: {
  chat: ChatRef
  onClose: () => void
  returnFocus: RefObject<HTMLElement | null>
}) {
  const { rename } = useChatList()
  const field = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  const finish = (value: string | null) => {
    if (done.current) return
    done.current = true
    const focused = document.activeElement === field.current
    onClose()
    if (value !== null) rename(chat, value)
    // After the field has gone and the … is back.
    if (focused) requestAnimationFrame(() => returnFocus.current?.focus())
  }
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
    // Selecting scrolls a long title to its end; show its start.
    if (field.current !== null) field.current.scrollLeft = 0
  }, [])
  return (
    <>
      <Input
        ref={field}
        aria-label="Chat title"
        dir="auto"
        enterKeyHint="done"
        defaultValue={chat.title ?? ""}
        maxLength={TITLE_MAX}
        onBlur={(event) => finish(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish(event.currentTarget.value)
          if (event.key === "Escape") {
            // Not on to the page around it (the drawer's own Escape is
            // canceled in chat-sidebar.tsx).
            event.stopPropagation()
            finish(null)
          }
        }}
      />
      <EditActions
        onCancel={() => finish(null)}
        onSave={() => finish(field.current?.value ?? null)}
      />
    </>
  )
}
