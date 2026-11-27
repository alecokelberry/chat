// Search: find a chat (its dialog and list are search-chats.tsx). ⌘K
// (Ctrl+K elsewhere) opens it from anywhere in the signed-in app, and so
// does a search icon (SearchButton) beside the sidebar's toggle, in the
// phone's header and at the top of the phone's drawer: all of them open
// the one dialog through its controller. It's ui-sdk's Command in a Dialog
// (the Command docs' palette): a dialog on a computer, a sheet on a touch
// phone. ⌘K again closes it, and it opens empty each time (its content
// unmounts when closed).
//
// Only the controller, the icons and ⌘K are in the first load: the dialog
// and its list load when Search is about to open (the pointer over an
// icon, focus on it, a press or ⌘K), and Search opens once they have.
// Loaded, they stay.
import { useRef, useSyncExternalStore, type ComponentProps } from "react"

import {
  createDialogController,
  useDialogShortcut,
  type DialogController,
} from "@/components/ui/dialog"
import { SidebarSearchTrigger } from "@/components/ui/sidebar"

const SEARCH_SHORTCUT = "mod+k"

type List = typeof import("@/components/chat/search-chats")

let list: List | undefined
let loading: Promise<List> | undefined
const listeners = new Set<() => void>()

/** Loads the list's code, once. */
function loadList(): Promise<List> {
  loading ??= import("@/components/chat/search-chats").then((loaded) => {
    list = loaded
    listeners.forEach((listener) => listener())
    return loaded
  })
  return loading
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** What opens and closes Search: one per signed-in shell. */
export const createSearchController = (): DialogController =>
  createDialogController()

/** Opens Search once its list has loaded. */
const openSearch = (controller: DialogController) =>
  void loadList().then(() => controller.open())

/** A search icon that opens Search, loading its list on the way. */
export function SearchButton({
  controller,
  onClick,
  ...props
}: Omit<
  ComponentProps<typeof SidebarSearchTrigger>,
  "shortcut" | "onIntent" | "onOpen"
> & { controller: DialogController; onClick?: () => void }) {
  return (
    <SidebarSearchTrigger
      shortcut={SEARCH_SHORTCUT}
      onIntent={() => void loadList()}
      onOpen={() => {
        onClick?.()
        openSearch(controller)
      }}
      {...props}
    />
  )
}

/** The dialog itself, and ⌘K to open and close it. */
export function SearchDialog({ controller }: { controller: DialogController }) {
  const content = useRef<HTMLDivElement>(null)
  useDialogShortcut(controller, SEARCH_SHORTCUT, content, "Search", () =>
    openSearch(controller)
  )
  const loaded = useSyncExternalStore(
    subscribe,
    () => list,
    () => undefined
  )
  return (
    loaded !== undefined && (
      <loaded.SearchPanel controller={controller} content={content} />
    )
  )
}
