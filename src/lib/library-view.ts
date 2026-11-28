// How the Library shows its files, as Grok's view options do: as a grid or
// a list, newest or oldest first, remembered on this device. A cookie, like
// the sidebar's (src/lib/sidebar.ts), so the server renders the saved view
// and order and a reload never shows the other first: the server reads the
// request's, the browser its own.
import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

import { LIBRARY_ORDERS, type LibraryOrder } from "@/lib/chat/library-items"

export const LIBRARY_VIEWS = ["grid", "list"] as const
export type LibraryView = (typeof LIBRARY_VIEWS)[number]

export type LibraryLook = { view: LibraryView; order: LibraryOrder }

const COOKIE = "library"
const SAVED = new RegExp(`(?:^|;\\s*)${COOKIE}=(\\w+)\\.(\\w+)(?:;|$)`)

/** The look saved in `cookie`, or Grok's default: a grid, newest first. */
export function lookIn(cookie: string): LibraryLook {
  const [, view, order] = SAVED.exec(cookie) ?? []
  return {
    view: LIBRARY_VIEWS.find((known) => known === view) ?? "grid",
    order: LIBRARY_ORDERS.find((known) => known === order) ?? "newest",
  }
}

export const libraryLook = createIsomorphicFn()
  .server(() => lookIn(getRequestHeader("cookie") ?? ""))
  .client(() => lookIn(document.cookie))

export function saveLibraryLook({ view, order }: LibraryLook) {
  // oxlint-disable-next-line unicorn/no-document-cookie -- two words; the Cookie Store API isn't in Safari before 18.4
  document.cookie = `${COOKIE}=${view}.${order}; path=/; max-age=31536000; samesite=lax`
}
