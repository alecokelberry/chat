// Whether the computer's sidebar is collapsed to its rail. It's a cookie,
// so the server renders the right width and a reload never shows the other
// one first: the server reads the request's, the browser its own.
import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

const COOKIE = "sidebar"
const RAIL = new RegExp(`(?:^|;\\s*)${COOKIE}=rail(?:;|$)`)

export const isSidebarCollapsed = createIsomorphicFn()
  .server(() => RAIL.test(getRequestHeader("cookie") ?? ""))
  .client(() => RAIL.test(document.cookie))

export function saveSidebarCollapsed(collapsed: boolean) {
  // oxlint-disable-next-line unicorn/no-document-cookie -- one flag; the Cookie Store API isn't in Safari before 18.4
  document.cookie = `${COOKIE}=${collapsed ? "rail" : "column"}; path=/; max-age=31536000; samesite=lax`
}
