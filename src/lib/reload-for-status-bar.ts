// The one reload the app makes on its own: an iPhone's Home Screen app
// colors its status bar from the theme-color a page loads with, so a new
// theme needs a load before the bar follows. It reloads the moment the
// theme changes, even with the drawer and the account menu open over the
// page, and the new page comes back the way the old one was left:
//
//   pick Theme ─► note what's open (drawer, account menu), the chat
//                 list's scroll and the composer's draft, in sessionStorage
//              └► location.reload(): the server renders the new theme-color
//   new page   ─► RESTORE_SCRIPT, in the head, hides the page while it
//                 rebuilds what was open (data-restoring), so WebKit keeps
//                 showing the old frame instead of a page with nothing open
//              └► the drawer opens with no slide, the menu opens in it, the
//                 list scrolls back, and the page shows (restored())
//
// Only a streaming reply holds it back (data-busy), since a reload would
// cut the reply off. No view transition: its full-screen layer covers the
// top edge while the new page arrives, and iOS keeps the bar's old color
// under a full-screen layer.

const KEY = "reload-kept"

/** Hidden past this long, the page shows anyway: a restore that never
 *  finishes must not leave a blank screen. */
const REVEAL_BY_MS = 1500

type Part = "drawer" | "menu" | "list"

type Kept = {
  draft?: string
  drawer?: boolean
  menu?: boolean
  /** How far the drawer's chat list was scrolled, when it was. */
  list?: number
}

/** Runs in the head, before the first paint: hides the page while what was
 *  open before the reload comes back. */
export const RESTORE_SCRIPT = `(() => {
  try {
    const kept = JSON.parse(sessionStorage.getItem(${JSON.stringify(KEY)}) ?? "null")
    if (!kept?.drawer) return
    const root = document.documentElement
    root.dataset.restoring = ""
    setTimeout(() => delete root.dataset.restoring, ${REVEAL_BY_MS})
  } catch {}
})()`

const BUSY = "[data-busy]"

/** The drawer's chat list, the one that scrolls. */
const LIST = '[data-sidebar-drawer] [aria-label="Chat list"]'
let waiting: number | undefined

function isOpen(selector: string) {
  return document.querySelector(selector)?.checkVisibility() === true
}

/** Notes what's open and reloads; while a reply streams, once it ends. */
export function reloadForStatusBar() {
  if (waiting !== undefined) return
  const reload = () => {
    clearInterval(waiting)
    try {
      const draft = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Message"]'
      )?.value
      const drawer = isOpen("[data-sidebar-drawer][data-open]")
      const top = drawer ? (document.querySelector(LIST)?.scrollTop ?? 0) : 0
      const kept: Kept = {
        draft: draft === "" ? undefined : draft,
        drawer,
        menu: drawer && isOpen("[data-account-menu][data-open]"),
        list: top > 0 ? top : undefined,
      }
      sessionStorage.setItem(KEY, JSON.stringify(kept))
    } catch {}
    location.reload()
  }
  if (document.querySelector(BUSY) === null) return reload()
  waiting = window.setInterval(() => {
    if (document.querySelector(BUSY) === null) reload()
  }, 200)
}

let kept: Kept | undefined

/** What the page had open before reloading for the status bar. Read once
 *  from storage, then kept for every part that asks during this load. */
function keptState(): Kept {
  if (kept !== undefined) return kept
  let found: Kept = {}
  try {
    found = JSON.parse(sessionStorage.getItem(KEY) ?? "null") ?? {}
    sessionStorage.removeItem(KEY)
  } catch {}
  kept = found
  return found
}

/** The draft the page had before reloading for the status bar, once. */
export function takeReloadDraft() {
  const draft = keptState().draft ?? ""
  delete keptState().draft
  return draft
}

/** Whether the drawer or the menu was open before the reload, so it opens
 *  again. */
export function wasOpen(part: "drawer" | "menu") {
  return keptState()[part] === true
}

/** How far the drawer's chat list was scrolled before the reload, if at
 *  all, so it scrolls back. */
export function keptListScroll() {
  return keptState().list
}

/** A part is back as it was; once every one is, the page shows. */
export function restored(part: Part) {
  const state = keptState()
  if (part === "list") delete state.list
  else state[part] = false
  if (state.drawer !== true && state.menu !== true && state.list === undefined)
    delete document.documentElement.dataset.restoring
}
