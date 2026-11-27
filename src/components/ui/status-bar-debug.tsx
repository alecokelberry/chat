// A temporary readout for the iPhone status bar bug: which build is
// running and every input iOS could color the bar from. It shows with
// ?debug=bar in the address (?debug=off hides it), or, in the Home Screen
// app, which has no address bar, after three quick taps on the drawer's
// mark; the choice is kept in this browser. It sits mid-screen, clear of
// the top edge, so it never becomes what iOS samples. Remove it once the
// bar is fixed.
// Its trials each flip one live input to the other theme's color, with
// no reload and no theme change, so a look at the bar shows whether iOS
// follows it live: the theme-color tags edited in place, one tag with no
// media query in place of the pair, or the page's own background. They
// stay until a reload.
import * as React from "react"

import { Button } from "@/components/ui/button"
import { THEME_COLOR } from "@/lib/theme"

const KEY = "debug-bar"
const BUILD: string = import.meta.env.VITE_BUILD
const LOADED_AT = new Date().toLocaleTimeString()

function on() {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

function set(value: boolean) {
  try {
    if (value) localStorage.setItem(KEY, "1")
    else localStorage.removeItem(KEY)
  } catch {}
  dispatchEvent(new Event(KEY))
}

let taps: number[] = []
/** Three taps within a second on [data-debug-taps] flip the readout. */
function countDebugTap(event: MouseEvent) {
  if (!(event.target instanceof Element)) return
  if (event.target.closest("[data-debug-taps]") === null) return
  const now = Date.now()
  taps = [...taps.filter((t) => now - t < 1000), now]
  if (taps.length < 3) return
  taps = []
  set(!on())
}

/** The fixed and sticky elements from the top edge's middle, 4px in, up. */
function topEdge() {
  const sheet = document.createElement("style")
  sheet.textContent = "* { pointer-events: auto !important }"
  document.head.appendChild(sheet)
  let hit: Element | null
  try {
    hit = document.elementFromPoint(document.documentElement.clientWidth / 2, 4)
  } finally {
    sheet.remove()
  }
  const chain: string[] = []
  for (let el = hit; el !== null; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (el !== hit && style.position !== "fixed" && style.position !== "sticky")
      continue
    const rect = el.getBoundingClientRect()
    const slot = el.getAttribute("data-slot") ?? ""
    chain.push(
      `${el.tagName.toLowerCase()}${slot === "" ? "" : `.${slot}`} ${style.position} ${Math.round(rect.width)}x${Math.round(rect.height)} ${style.backgroundColor} o${style.opacity}`
    )
  }
  return chain
}

type Trial = "tags" | "one" | "page"

const TRIALS: { trial: Trial; label: string }[] = [
  { trial: "tags", label: "Edit tags" },
  { trial: "one", label: "One tag" },
  { trial: "page", label: "Page color" },
]

/** Flips one input to `scheme`'s color. */
function tryInput(trial: Trial, scheme: "light" | "dark") {
  const color = THEME_COLOR[scheme]
  const tags = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]'
  )
  if (trial === "tags") for (const tag of tags) tag.content = color
  if (trial === "one") {
    const one = document.createElement("meta")
    one.name = "theme-color"
    one.content = color
    for (const tag of tags) tag.remove()
    document.head.appendChild(one)
  }
  if (trial === "page") {
    document.documentElement.style.backgroundColor = color
    document.body.style.backgroundColor = color
  }
}

/** The iOS and Safari versions, from the user agent. */
function versions() {
  const ua = navigator.userAgent
  const os = /OS (\d+[_\d]*)/.exec(ua)?.[1]?.replaceAll("_", ".") ?? "?"
  const safari = /Version\/([\d.]+)/.exec(ua)?.[1] ?? "?"
  return `iOS ${os} · Safari ${safari}`
}

function themeCookie() {
  return /(?:^|; )theme=(\w+)/.exec(document.cookie)?.[1] ?? "none"
}

function read(loadedAs: string, changes: string[], tried: string[]) {
  const html = document.documentElement
  const metas = [
    ...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
  ].map(
    (m) =>
      `${m.content} ${m.media} ${m.media === "" || matchMedia(m.media).matches ? "✓" : "✗"}`
  )
  const vv = window.visualViewport
  const probe = document.createElement("div")
  probe.style.cssText = "position:absolute;padding-top:env(safe-area-inset-top)"
  document.body.appendChild(probe)
  const safeTop = getComputedStyle(probe).paddingTop
  probe.remove()
  return [
    `build ${BUILD} · loaded ${LOADED_AT} as ${loadedAs}`,
    versions(),
    `standalone ${matchMedia("(display-mode: standalone)").matches ? "yes" : "no"} · phone ${matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"}`,
    `theme ${html.dataset.colorScheme ?? "?"} · cookie ${themeCookie()} · html ${getComputedStyle(html).backgroundColor} · body ${getComputedStyle(document.body).backgroundColor}`,
    ...metas.map((m) => `meta ${m}`),
    `safe top ${safeTop} · inner ${innerHeight} · vv ${Math.round(vv?.height ?? 0)}@${Math.round(vv?.offsetTop ?? 0)} · screen ${screen.height}`,
    "top edge:",
    ...topEdge().map((line) => `  ${line}`),
    `theme changes: ${changes.join(", ") || "none"}`,
    `trials: ${tried.join(", ") || "none"}`,
  ]
}

function subscribe(change: () => void) {
  addEventListener(KEY, change)
  addEventListener("click", countDebugTap)
  return () => {
    removeEventListener(KEY, change)
    removeEventListener("click", countDebugTap)
  }
}

function StatusBarDebug() {
  const shown = React.useSyncExternalStore(subscribe, on, () => false)
  const [lines, setLines] = React.useState<string[]>([])
  const loadedAs = React.useRef("")
  const changes = React.useRef<string[]>([])
  const tried = React.useRef<string[]>([])
  const next = React.useRef<"light" | "dark" | null>(null)

  React.useEffect(() => {
    const param = new URLSearchParams(location.search).get("debug")
    if (param === "bar") set(true)
    if (param === "off") set(false)
    loadedAs.current = document.documentElement.dataset.colorScheme ?? "?"
    let last = loadedAs.current
    const watch = new MutationObserver(() => {
      const now = document.documentElement.dataset.colorScheme ?? "?"
      if (now === last) return
      last = now
      // A new theme shows: the next trial starts from its opposite again.
      next.current = null
      changes.current = [
        ...changes.current.slice(-3),
        `${now} ${new Date().toLocaleTimeString()}`,
      ]
    })
    watch.observe(document.documentElement, {
      attributeFilter: ["data-color-scheme"],
    })
    return () => {
      watch.disconnect()
    }
  }, [])

  React.useEffect(() => {
    if (!shown) return
    const update = () =>
      setLines(read(loadedAs.current, changes.current, tried.current))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [shown])

  const run = (trial: Trial) => {
    // Each tap flips to the other color, starting from the one not showing.
    next.current ??= getComputedStyle(
      document.documentElement
    ).colorScheme.includes("dark")
      ? "light"
      : "dark"
    const scheme = next.current
    tryInput(trial, scheme)
    next.current = scheme === "dark" ? "light" : "dark"
    tried.current = [
      ...tried.current.slice(-3),
      `tried ${trial} ${scheme} ${new Date().toLocaleTimeString()}`,
    ]
    setLines(read(loadedAs.current, changes.current, tried.current))
  }

  if (!shown) return null
  return (
    <div
      data-slot="status-bar-debug"
      className="pointer-events-none fixed inset-x-2 top-1/3 z-50 overflow-hidden rounded-lg bg-black p-2 text-white"
    >
      <pre className="font-mono text-xs/tight whitespace-pre-wrap">
        {lines.join("\n")}
      </pre>
      <div className="pointer-events-auto mt-2 flex flex-wrap gap-2">
        {TRIALS.map(({ trial, label }) => (
          <Button
            key={trial}
            variant="outline"
            size="sm"
            className="border-white/40 text-white"
            onClick={() => run(trial)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export { StatusBarDebug }
