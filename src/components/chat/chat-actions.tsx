// A chat's actions, the archived Chat's (Grok's), in each sidebar row's …
// menu and the open chat's header …: Pin or Unpin, Rename, then Open in
// new tab (a real link, so it opens the way the browser opens links).
//
// Pin and Rename go through the chat list (chat-list.tsx), which shows
// them at once and saves them.
//
// RenameField is the title being renamed, in a row or the header's pill:
// it opens focused with the title selected; Enter, ✓ or leaving saves,
// Escape or ✕ cancels, and focus goes back to the … that opened it. A
// blank or unchanged title saves nothing.
import { useEffect, useRef, type RefObject } from "react"
import { Link } from "@tanstack/react-router"
import { ExternalLinkIcon, PencilIcon, PinIcon, PinOffIcon } from "lucide-react"

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
}: {
  chat: ChatRef
  onRename: () => void
  /** Called as Pin or Unpin is chosen. */
  onPin?: () => void
}) {
  const { pin } = useChatList()
  return (
    <MenuContent align="end" side="bottom">
      <MenuGroup>
        <MenuItem
          onSelect={() => {
            onPin?.()
            pin(chat, !chat.pinned)
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
    </MenuContent>
  )
}

/** The title being renamed: place it in a SidebarRowEdit or a
 *  HeaderTitleEdit. It saves through the list and calls `onClose`; if
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
        defaultValue={chat.title ?? ""}
        maxLength={TITLE_MAX}
        onBlur={(event) => finish(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish(event.currentTarget.value)
          if (event.key === "Escape") {
            // Not on to the drawer or the page around it.
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
