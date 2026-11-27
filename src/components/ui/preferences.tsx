// Saved choices: ui-sdk's Preferences, kept in this browser's localStorage
// and put on <html> as a data attribute. For now, the one choice is the
// color scheme (data-color-scheme: system, light or dark), which app.css's
// dark variant follows; the account menu's Theme flips it. <AppPreferences>
// sits at the top of <body>; on the server it renders an inline script
// that sets the attributes before the first paint, so CSS that selects
// them is right from the start, with nothing to flash.
// The status bar follows the choice too, three ways. The Home Screen app
// on an iPhone draws the bar itself, in the theme-color the page loads
// with, and never looks again: so the choice is copied into a cookie
// (src/lib/theme.ts) for the server to write the right color into the
// HTML, and a change there reloads the page once nothing is open over
// it (src/lib/reload-for-status-bar.ts). Safari on iOS 26 ignores
// theme-color and colors the bar from the fixed or sticky element at the
// top edge (here, the shell's solid background), looking again only when
// such an element comes or goes, so a change briefly shows a strip it
// takes its color from (nudgeStatusBar). Other browsers read theme-color,
// which StatusBarColor keeps in step; THEME_COLOR_SCRIPT sets it before
// the first paint for a choice saved before the cookie was.
import * as React from "react"
// oxlint-disable-next-line no-restricted-imports -- preferences and storage have no entry of their own
import { createColorScheme, createLocalStorage } from "@ui-sdk/core"
import { Preferences, usePreference } from "@ui-sdk/react/preferences"
import { useShortcut } from "@ui-sdk/react/shortcuts"

import { StatusBarDebug } from "@/components/ui/status-bar-debug"
import { reloadForStatusBar } from "@/lib/reload-for-status-bar"
import { saveTheme, THEME_COLOR, themeCookie } from "@/lib/theme"

/** Where createLocalStorage keeps the choice: "system", "light" or "dark". */
const STORAGE_KEY = "theme"

/** Runs in the head, right after the theme-color tags: a saved Light or
 *  Dark points both at its color before the first paint, and the choice is
 *  copied into the cookie, so a choice saved before there was one reaches
 *  the server from the next load on. */
const THEME_COLOR_SCRIPT = `(() => {
  try {
    const colors = ${JSON.stringify(THEME_COLOR)}
    const cookies = ${JSON.stringify({
      light: themeCookie("light"),
      dark: themeCookie("dark"),
      system: themeCookie("system"),
    })}
    const saved = localStorage.getItem(${JSON.stringify(STORAGE_KEY)})
    if (cookies[saved]) document.cookie = cookies[saved]
    const color = colors[saved]
    if (!color) return
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.content = color
  } catch {}
})()`

const colorScheme = createColorScheme({
  storage: createLocalStorage(STORAGE_KEY),
  global: true,
  onValueChange: snapColors,
  onSystemValueChange: snapColors,
})

/** A theme change snaps every color at once (DESIGN.md › Motion: a
 *  keyboard action never animates). Without this, controls with a color
 *  transition (press, hovers) would ease from the old theme's ink for a
 *  frame or more. ui-sdk calls this before it changes the attribute; the
 *  hold lifts after two frames, once the new colors have painted. */
function snapColors() {
  const root = document.documentElement
  root.dataset.themeChanging = ""
  requestAnimationFrame(() =>
    requestAnimationFrame(() => delete root.dataset.themeChanging)
  )
}

function AppPreferences({ children }: { children: React.ReactNode }) {
  return (
    <Preferences preferences={[colorScheme]}>
      <StatusBarColor />
      <StatusBarDebug />
      {children}
    </Preferences>
  )
}

/** Keeps the cookie and the theme-color metas (src/routes/__root.tsx) on
 *  the choice: a Light or Dark choice points both tags at its color. Each
 *  is swapped for a fresh copy rather than edited: the phone drawer dims
 *  the tags it found when it opened (ui-sdk's themeColor) and puts their
 *  old colors back when it closes, which would undo a theme picked inside
 *  it. React never changes these tags after the first render, so it
 *  doesn't miss them. The first renders can carry the server's guess
 *  rather than the saved choice; <html>, set before the first paint, says
 *  which is real, so a guess is never saved or acted on. */
function StatusBarColor() {
  const { value, resolved } = usePreference(colorScheme)
  const picked = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (value !== choiceShowing()) return
    saveTheme(value)
    pointMetasAt(value)
    picked.current ??= value
    if (picked.current === value) return
    picked.current = value
    // The Home Screen app reads the color again only on a load, so a new
    // pick reloads (it's saved by now), smoothly and once the page is
    // settled. A system flip under System waits for the next launch.
    if (isHomeScreenApp()) reloadForStatusBar()
  }, [value])
  // Only when the colors change: at launch the bar is already right.
  const shown = React.useRef<"light" | "dark" | null>(null)
  React.useEffect(() => {
    const showing = schemeShowing()
    shown.current ??= showing
    if (resolved !== showing || shown.current === resolved) return
    shown.current = resolved
    if (isHomeScreenApp()) return
    return nudgeStatusBar()
  }, [resolved])
  return null
}

function pointMetasAt(value: "light" | "dark" | "system") {
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
}

/** The choice <html> carries: light, dark or system. */
function choiceShowing() {
  return document.documentElement.dataset.colorScheme ?? "system"
}

/** The scheme <html> shows: its saved choice, or the system's. */
function schemeShowing() {
  const scheme = choiceShowing()
  if (scheme === "light" || scheme === "dark") return scheme
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/** Whether this is an iPhone's Home Screen app, which draws its own
 *  status bar: navigator.standalone is iOS's alone. */
function isHomeScreenApp() {
  return "standalone" in navigator && navigator.standalone === true
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
  THEME_COLOR_SCRIPT,
  useIsDark,
  useThemeShortcut,
  useToggleTheme,
}
