// Saved choices: ui-sdk's Preferences, kept in this browser's localStorage
// and put on <html> as a data attribute. For now, the one choice is the
// color scheme (data-color-scheme: system, light or dark), which app.css's
// dark variant follows; the account menu's Theme flips it. <AppPreferences>
// sits at the top of <body>; on the server it renders an inline script
// that sets the attributes before the first paint, so CSS that selects
// them is right from the start, with nothing to flash.
// The status bar follows the choice too. iOS 26 ignores theme-color and
// colors the bar from the fixed or sticky element at the top edge (here,
// the shell's solid background), or the page's when there's none. It looks
// again only when such an element comes or goes, and keeps the color it has
// while a full-screen layer or the drawer covers the edge, so a theme change
// briefly shows a strip it does take its color from (nudgeStatusBar).
// theme-color, which other browsers read, follows too: an inline script in
// the head (THEME_COLOR_SCRIPT) points the tags at the saved choice before
// the first paint, and StatusBarColor keeps them in step after.
import * as React from "react"
// oxlint-disable-next-line no-restricted-imports -- preferences and storage have no entry of their own
import { createColorScheme, createLocalStorage } from "@ui-sdk/core"
import { Preferences, usePreference } from "@ui-sdk/react/preferences"
import { useShortcut } from "@ui-sdk/react/shortcuts"

import { StatusBarDebug } from "@/components/ui/status-bar-debug"

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
      <StatusBarDebug />
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
  // Only when the colors change: at launch the shell's are already right.
  const shown = React.useRef(resolved)
  React.useEffect(() => {
    if (shown.current === resolved) return
    shown.current = resolved
    return nudgeStatusBar()
  }, [resolved])
  return null
}

/** How long the strip stays: a few frames, so iOS samples it at least
 *  once. */
const NUDGE_MS = 100

/** Makes iOS 26 color the status bar again, from the new background.
 *  WebKit (LocalFrameView::fixedContainerEdges) samples the top edge only
 *  when a fixed or sticky element is added or removed. It takes a fresh
 *  color only from a full-width bar taller than 10px and at least 10%
 *  opaque; a full-screen layer, a dimming backdrop or a side drawer keeps
 *  the color the edge had. So this shows such a bar, in the page's
 *  background at 12% over the top 16px, for 100 ms: a manual popover, in
 *  the top layer above an open drawer or menu, that lets every tap
 *  through and leaves focus alone. After it goes, the shell (or the drawer
 *  over it) keeps the color it gave. Returns its cleanup. */
function nudgeStatusBar() {
  // A browser without popovers has no top layer to show it in.
  if (!("showPopover" in HTMLElement.prototype)) return
  const strip = document.createElement("div")
  strip.popover = "manual"
  strip.ariaHidden = "true"
  strip.dataset.slot = "status-bar-nudge"
  strip.style.cssText =
    "position:fixed;inset:0 0 auto 0;width:auto;height:16px;margin:0;padding:0;border:0;background:var(--background);opacity:0.12;pointer-events:none"
  document.body.appendChild(strip)
  strip.showPopover()
  const timer = window.setTimeout(() => strip.remove(), NUDGE_MS)
  return () => {
    clearTimeout(timer)
    strip.remove()
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
