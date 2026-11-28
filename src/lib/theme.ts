// The theme the account menu saved (light, dark or system), copied into a
// cookie so the server writes the right theme-color into the page. iOS's
// Home Screen app colors its status bar at launch from the theme-color it
// finds as the page loads, so the tag has to be right in the HTML itself:
// a script that fixes it afterwards is too late. Later changes recolor the
// bar live (src/components/ui/preferences.tsx). The choice
// itself lives in localStorage (ui-sdk's Preferences); this only mirrors it.
// With nothing saved the app follows the device, live; the one Theme
// button saves an override only while it differs from the device, so
// switching back to what the device shows follows it again (nextTheme).
// The accent color's pre-paint script is here too, so the first load
// doesn't carry its color math (src/lib/accent.ts).
import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"

type Theme = "light" | "dark" | "system"

/** The status bar's color, light and dark: the page's --background in
 *  app.css, repeated here because the server writes it into the head. */
export const THEME_COLOR = { light: "#f9f8f7", dark: "#1e1d1d" } as const

/** What the Theme button saves when tapped while `showing` is on screen:
 *  the other scheme, or "system" when that is what the device shows, so
 *  the app follows the device again (and keeps following it, at sunset
 *  say). One button covers all three choices, with no picker. */
export function nextTheme(
  showing: "light" | "dark",
  device: "light" | "dark" | "unknown"
): Theme {
  const next = showing === "dark" ? "light" : "dark"
  return next === device ? "system" : next
}

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

/** Where the accent color is kept (src/lib/accent.ts): its pick and the
 *  light and dark colors it becomes. */
export const ACCENT_KEY = "accent"

/** Runs in the head before the first paint: the saved accent's two colors
 *  onto <html>, as --accent-light and --accent-dark, which app.css's
 *  --send reads. Only six-digit hex gets through to the style. */
export const ACCENT_SCRIPT = `(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(${JSON.stringify(ACCENT_KEY)}) || "null")
    const hex = /^#[0-9a-f]{6}$/
    if (!saved || !hex.test(saved.light) || !hex.test(saved.dark)) return
    const style = document.documentElement.style
    style.setProperty("--accent-light", saved.light)
    style.setProperty("--accent-dark", saved.dark)
  } catch {}
})()`
