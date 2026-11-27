// The one reload the app makes on its own: an iPhone's Home Screen app
// colors its status bar from the theme-color a page loads with, so a new
// theme needs a load before the bar follows. It waits until nothing is
// open over the page (the drawer, a menu, a sheet) and no reply is coming
// in, keeps the composer's draft, and crossfades from the old page to the
// new one (a cross-document view transition, app.css) instead of flashing.
// The page looks the same on both sides, so the only change is the bar.

const FLAG = "reload-for-status-bar"
const DRAFT = "reload-draft"
const SETTLED = '[role="dialog"], [role="menu"], [data-busy]'

let waiting: number | undefined

function settled() {
  return [...document.querySelectorAll(SETTLED)].every(
    (el) => !el.checkVisibility()
  )
}

/** Reloads once the page is settled for two checks in a row, so a closing
 *  drawer has finished sliding away before the old page is captured. */
export function reloadForStatusBar() {
  if (waiting !== undefined) return
  let calm = 0
  waiting = window.setInterval(() => {
    calm = settled() ? calm + 1 : 0
    if (calm < 2) return
    clearInterval(waiting)
    try {
      const draft = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Message"]'
      )?.value
      if (draft !== undefined && draft !== "")
        sessionStorage.setItem(DRAFT, draft)
      sessionStorage.setItem(FLAG, "1")
    } catch {}
    // A replace, not reload(): a reload never gets a view transition.
    location.replace(location.href)
  }, 200)
}

/** The draft the page had before reloading for the status bar, once. */
export function takeReloadDraft() {
  try {
    const draft = sessionStorage.getItem(DRAFT)
    sessionStorage.removeItem(DRAFT)
    return draft ?? ""
  } catch {
    return ""
  }
}

/** Runs in the head of every page: the crossfade is for this reload alone,
 *  so any other navigation between pages skips it, on both sides. */
export const RELOAD_TRANSITION_SCRIPT = `(() => {
  const ours = () => {
    try { return sessionStorage.getItem(${JSON.stringify(FLAG)}) === "1" } catch { return false }
  }
  addEventListener("pageswap", (event) => {
    if (event.viewTransition && !ours()) event.viewTransition.skipTransition()
  })
  addEventListener("pagereveal", (event) => {
    const mine = ours()
    try { sessionStorage.removeItem(${JSON.stringify(FLAG)}) } catch {}
    if (event.viewTransition && !mine) event.viewTransition.skipTransition()
  })
})()`
