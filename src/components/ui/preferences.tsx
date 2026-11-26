// Saved choices: ui-sdk's Preferences, kept in this browser's localStorage
// and put on <html> as a data attribute. For now, the one choice is the
// color scheme (data-color-scheme: system, light or dark), which app.css's
// dark variant follows; the account menu's Theme flips it. <AppPreferences>
// sits at the top of <body>; on the server it renders an inline script
// that sets the attributes before the first paint, so CSS that selects
// them is right from the start, with nothing to flash.
// The status bar follows the choice too: an inline script in the head
// (THEME_COLOR_SCRIPT) points the theme-color tags at the saved choice
// before the first paint, and StatusBarColor keeps them in step after.
// iOS 26 reads the bar's color when the app launches and again only when
// a layer appears over the page, not when the page's colors change, so a
// change also briefly shows an empty, invisible layer (nudgeStatusBar).
import * as React from "react"
// oxlint-disable-next-line no-restricted-imports -- preferences and storage have no entry of their own
import { createColorScheme, createLocalStorage } from "@ui-sdk/core"
import { Preferences, usePreference } from "@ui-sdk/react/preferences"
import { useShortcut } from "@ui-sdk/react/shortcuts"

/** The status bar's color, light and dark: the page's --background in
 *  app.css, repeated here because the server writes it into the head. */
const THEME_COLOR = { light: "#f9f8f7", dark: "#1e1d1d" } as const

/** Where createLocalStorage keeps the choice: "system", "light" or "dark". */
const STORAGE_KEY = "theme"

/** Runs in the head, right after the theme-color tags: a saved Light or
 *  Dark points both at its color before the first paint, so a home-screen
 *  app launches with the bar in the app's theme, not the phone's. */
const THEME_COLOR_SCRIPT = `(() => {
  try {
    const colors = ${JSON.stringify(THEME_COLOR)}
    const color = colors[localStorage.getItem(${JSON.stringify(STORAGE_KEY)})]
    if (!color) return
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = color
  } catch {}
})()`

const colorScheme = createColorScheme({
  storage: createLocalStorage(STORAGE_KEY),
  global: true,
})

function AppPreferences({ children }: { children: React.ReactNode }) {
  return (
    <Preferences preferences={[colorScheme]}>
      <StatusBarColor />
      {children}
    </Preferences>
  )
}

/** The theme-color metas (src/routes/__root.tsx) follow the system; a
 *  Light or Dark choice points both at its color. Each is swapped for a
 *  fresh copy rather than edited: the phone drawer dims the tags it found
 *  when it opened (ui-sdk's themeColor) and puts their old colors back when
 *  it closes, which would undo a theme picked inside it. React never
 *  changes these tags after the first render, so it doesn't miss them. */
function StatusBarColor() {
  const { value, resolved } = usePreference(colorScheme)
  React.useEffect(() => {
    const metas = document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )
    for (const meta of metas) {
      const own = meta.media.includes("dark") ? "dark" : "light"
      const content = THEME_COLOR[value === "system" ? own : value]
      if (meta.content === content) continue
      const fresh = document.createElement("meta")
      fresh.name = "theme-color"
      fresh.media = meta.media
      fresh.content = content
      meta.replaceWith(fresh)
    }
  }, [value])
  // On load too, which costs nothing and settles the launch color.
  React.useEffect(() => nudgeStatusBar(), [resolved])
  return null
}

/** How long the nudge's layer stays: long enough for iOS to notice it. */
const NUDGE_MS = 150

/** Makes iOS read the status bar's color again, once the new colors are
 *  painted: a full-screen manual popover, so in the top layer like a menu
 *  sheet, but empty, clear and letting every tap through, shown for 150 ms.
 *  A manual popover leaves open menus and focus alone. Returns its
 *  cleanup. */
function nudgeStatusBar() {
  const layer = document.createElement("div")
  layer.popover = "manual"
  layer.ariaHidden = "true"
  layer.dataset.slot = "status-bar-nudge"
  layer.style.cssText =
    "position:fixed;inset:0;width:auto;height:auto;margin:0;padding:0;border:0;background:transparent;pointer-events:none"
  let timer = 0
  const frame = requestAnimationFrame(() => {
    document.body.appendChild(layer)
    layer.showPopover()
    timer = window.setTimeout(() => layer.remove(), NUDGE_MS)
  })
  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    layer.remove()
  }
}

/** Flips light and dark, from whichever is showing. */
function useToggleTheme() {
  const { resolved } = usePreference(colorScheme)
  return () => colorScheme.set(resolved === "dark" ? "light" : "dark")
}

/** Whether dark is showing now (the system's choice included). */
function useIsDark() {
  return usePreference(colorScheme).resolved === "dark"
}

/** D flips the theme from anywhere signed in. ui-sdk leaves plain letters
 *  alone in text fields and pauses page shortcuts under a modal; an open
 *  menu isn't modal and takes D as type-ahead, so it holds the key too. */
function useThemeShortcut() {
  const toggle = useToggleTheme()
  useShortcut("d", toggle, {
    description: "Switch light and dark",
    when: () =>
      document.querySelector('[role="menu"], [role="dialog"]') === null,
  })
}

export {
  AppPreferences,
  THEME_COLOR,
  THEME_COLOR_SCRIPT,
  useIsDark,
  useThemeShortcut,
  useToggleTheme,
}
