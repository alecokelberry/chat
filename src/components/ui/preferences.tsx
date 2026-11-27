// Saved choices: ui-sdk's Preferences, kept in this browser's localStorage.
// The sidebar's Chats section keeps two (useChatsSection): whether it's
// open, and whether it sorts by last activity or by date created; the list
// renders only in the browser, so they're read there, never on the server.
// The rest are put on <html> as data attributes: the color scheme
// (data-color-scheme: system, light or dark), which app.css's dark variant
// follows and the account menu's Theme flips (System, the default, follows
// the device live; a flip back to the device's scheme returns to it), and whether replies' code
// wraps (data-code-wrap: scroll or wrap), from Settings. <AppPreferences>
// sits at the top of <body>; on the server it renders an inline script
// that sets the attributes before the first paint, so CSS that selects
// them is right from the start, with nothing to flash.
// The status bar follows the choice too. On iOS 26 and later, Safari and
// the Home Screen app both color it from the fixed or sticky element at
// the top edge (here, the shell's solid background), looking again only
// when such an element comes or goes, so a change shows a strip for one
// frame that iOS takes the new color from (nudgeStatusBar): no reload.
// Until then, at launch, the Home Screen app uses the theme-color the
// page loads with, so the choice is copied into a cookie (src/lib/theme.ts)
// for the server to write the right color into the HTML. Other browsers
// read theme-color live, which StatusBarColor keeps in step;
// THEME_COLOR_SCRIPT sets it before the first paint for a choice saved
// before the cookie was.
import * as React from "react"

import { CHAT_SORTS, type ChatSort } from "@/lib/chat/groups"
/* oxlint-disable no-restricted-imports -- preferences and storage have no entry of their own */
import {
  createColorScheme,
  createLocalStorage,
  createPreference,
} from "@ui-sdk/core"
/* oxlint-enable no-restricted-imports */
import { Preferences, usePreference } from "@ui-sdk/react/preferences"
import { useShortcut } from "@ui-sdk/react/shortcuts"

import { nextTheme, saveTheme, THEME_COLOR, themeCookie } from "@/lib/theme"

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

/** Whether a reply's long code lines wrap or scroll sideways (Settings ›
 *  Appearance), on <html> as data-code-wrap, which src/styles/prose.css
 *  follows. Saved in this browser, as the theme is, and set before the
 *  first paint the same way. */
const codeWrap = createPreference({
  values: ["scroll", "wrap"],
  defaultValue: "scroll",
  attribute: "data-code-wrap",
  storage: createLocalStorage("code-wrap"),
  global: true,
})

/** Whether code wraps, and how to change it. */
function useCodeWrap() {
  const { value } = usePreference(codeWrap)
  return [
    value === "wrap",
    (wrap: boolean) => codeWrap.set(wrap ? "wrap" : "scroll"),
  ] as const
}

function AppPreferences({ children }: { children: React.ReactNode }) {
  return (
    <Preferences preferences={[colorScheme, codeWrap]}>
      <StatusBarColor />
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
  React.useEffect(() => {
    if (value !== choiceShowing()) return
    saveTheme(value)
    pointMetasAt(value)
  }, [value])
  // Only when the colors change: at launch the bar is already right.
  const shown = React.useRef<"light" | "dark" | null>(null)
  React.useEffect(() => {
    const showing = schemeShowing()
    shown.current ??= showing
    if (resolved !== showing || shown.current === resolved) return
    shown.current = resolved
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

/** Makes iOS color the status bar again, from the new background, in
 *  Safari and in the Home Screen app alike. WebKit
 *  (LocalFrameView::fixedContainerEdges) samples the top edge only when a
 *  fixed or sticky element is added or removed, and takes a fresh color
 *  only from a full-width bar taller than 10px and at least 10% opaque.
 *  It never takes one while anything shows in the top layer (the phone's
 *  drawer and its menu are popovers), and a strip in the top layer
 *  doesn't count. So for one frame this shows such a bar, a plain fixed
 *  one in the page's background at 12% over the top 16px, and, on iOS,
 *  lifts the open popovers out of the top layer (liftOut) looking just as
 *  they did, then puts them back. iOS fades the bar to the new color.
 *  Measured on iOS 27.2 in the Simulator's Home Screen app: no frame
 *  differs but the bar. Returns its cleanup. */
function nudgeStatusBar() {
  let undo = () => {}
  let second = 0
  const first = requestAnimationFrame(() => {
    const strip = document.createElement("div")
    strip.ariaHidden = "true"
    strip.dataset.slot = "status-bar-nudge"
    strip.style.cssText =
      "position:fixed;inset:0 0 auto 0;height:16px;background:var(--background);opacity:0.12;pointer-events:none;z-index:2147483647"
    // navigator.standalone is iOS's alone: elsewhere nothing moves.
    const putBack =
      "standalone" in navigator
        ? [...document.querySelectorAll<HTMLElement>(":popover-open")].map(
            liftOut
          )
        : []
    document.body.appendChild(strip)
    undo = () => {
      strip.remove()
      for (const back of putBack) back()
      undo = () => {}
    }
    // Back on the next frame, so exactly one is drawn with the strip.
    second = requestAnimationFrame(() => undo())
  })
  return () => {
    cancelAnimationFrame(first)
    cancelAnimationFrame(second)
    undo()
  }
}

/** Takes an open popover out of the top layer without a visible change:
 *  it keeps its display, box and stacking with inline styles, and its
 *  ::backdrop's dim becomes its own fill (no ::backdrop outside the top
 *  layer). Returns what puts it back as it was, focus included. */
function liftOut(el: HTMLElement, index: number) {
  const box = el.getBoundingClientRect()
  const focused = document.activeElement
  const dim = backdropFill(el)
  const set: [string, string][] = [
    ["display", getComputedStyle(el).display],
    ["z-index", String(2147483000 + index)],
    ["width", `${box.width}px`],
    ["height", `${box.height}px`],
  ]
  if (dim !== null) set.push(["background-color", dim])
  const before = set.map(([name]): [string, string] => [
    name,
    el.style.getPropertyValue(name),
  ])
  for (const [name, value] of set) el.style.setProperty(name, value)
  el.hidePopover()
  const moved = el.getBoundingClientRect()
  const shift = `${box.x - moved.x}px ${box.y - moved.y}px`
  const translate = el.style.getPropertyValue("translate")
  if (moved.x !== box.x || moved.y !== box.y)
    el.style.setProperty("translate", shift)
  return () => {
    el.showPopover()
    for (const [name, value] of before) el.style.setProperty(name, value)
    el.style.setProperty("translate", translate)
    if (focused instanceof HTMLElement && document.activeElement !== focused)
      focused.focus({ preventScroll: true })
  }
}

/** A popover's ::backdrop fill with its opacity folded in, or null. */
function backdropFill(el: HTMLElement) {
  const backdrop = getComputedStyle(el, "::backdrop")
  const rgb = /rgba?\(([^)]+)\)/.exec(backdrop.backgroundColor)?.[1]
  if (rgb === undefined) return null
  const [r, g, b, a = 1] = rgb.split(",").map(Number)
  const alpha = a * Number(backdrop.opacity)
  return alpha > 0 ? `rgb(${r} ${g} ${b} / ${alpha})` : null
}

/** Flips light and dark, from whichever is showing; landing on the
 *  device's own scheme follows the device again (nextTheme). */
function useToggleTheme() {
  return () => {
    const { resolved, system } = colorScheme.get()
    colorScheme.set(nextTheme(resolved === "dark" ? "dark" : "light", system))
  }
}

/** Whether dark is showing now (the system's choice included). */
function useIsDark() {
  return usePreference(colorScheme).resolved === "dark"
}

/** D flips the theme from anywhere signed in. ui-sdk leaves plain letters
 *  alone in text fields and pauses page shortcuts under a modal. An open
 *  menu takes D as type-ahead (a row's D is Delete), so it holds the key,
 *  except the account menu (data-theme-menu): Theme lives there, and none
 *  of its items starts with D. */
function useThemeShortcut() {
  const toggle = useToggleTheme()
  useShortcut("d", toggle, {
    description: "Switch light and dark",
    when: () =>
      document.querySelector(
        '[role="dialog"], [role="menu"]:not([data-theme-menu])'
      ) === null,
  })
}

// ui-sdk requires an attribute on every preference; these two are never
// passed to <Preferences>, so nothing puts them on the page.
const chatsOpen = createPreference({
  values: ["open", "closed"],
  defaultValue: "open",
  attribute: "data-chats",
  storage: createLocalStorage("chats-open"),
})

const chatSort = createPreference({
  values: CHAT_SORTS,
  defaultValue: "updatedAt",
  attribute: "data-chat-sort",
  storage: createLocalStorage("chat-sort"),
})

/** The sidebar's Chats section, as this browser last left it: open or
 *  folded, and sorted by last activity or by date created. */
function useChatsSection() {
  const open = usePreference(chatsOpen).value === "open"
  const sort = usePreference(chatSort).value
  return {
    open,
    setOpen: (next: boolean) => chatsOpen.set(next ? "open" : "closed"),
    sort,
    setSort: (next: ChatSort) => chatSort.set(next),
  }
}

export {
  AppPreferences,
  useChatsSection,
  THEME_COLOR_SCRIPT,
  useCodeWrap,
  useIsDark,
  useThemeShortcut,
  useToggleTheme,
}
