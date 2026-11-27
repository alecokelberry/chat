// The theme the account menu saved (light, dark or system), copied into a
// cookie so the server writes the right theme-color into the page. iOS's
// Home Screen app colors its status bar at launch from the theme-color it
// finds as the page loads, so the tag has to be right in the HTML itself:
// a script that fixes it afterwards is too late. Later changes recolor the
// bar live (src/components/ui/preferences.tsx). The choice
// itself lives in localStorage (ui-sdk's Preferences); this only mirrors it.
import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

type Theme = "light" | "dark" | "system"

/** The status bar's color, light and dark: the page's --background in
 *  app.css, repeated here because the server writes it into the head. */
export const THEME_COLOR = { light: "#f9f8f7", dark: "#1e1d1d" } as const

const COOKIE = "theme"
const SAVED = new RegExp(`(?:^|;\\s*)${COOKIE}=(light|dark)(?:;|$)`)

function parse(cookie: string): Theme {
  const match = SAVED.exec(cookie)?.[1]
  return match === "light" || match === "dark" ? match : "system"
}

export const savedTheme = createIsomorphicFn()
  .server(() => parse(getRequestHeader("cookie") ?? ""))
  .client(() => parse(document.cookie))

/** The cookie line for a choice, shared with the head's inline script. */
export function themeCookie(theme: string) {
  return `${COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`
}

export function saveTheme(theme: Theme) {
  // oxlint-disable-next-line unicorn/no-document-cookie -- one value; the Cookie Store API isn't in Safari before 18.4
  document.cookie = themeCookie(theme)
}
