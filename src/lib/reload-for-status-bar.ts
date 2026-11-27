// The one reload the app makes on its own: an iPhone's Home Screen app
// colors its status bar from the theme-color a page loads with, so a new
// theme needs a load before the bar follows. It waits until nothing is
// open over the page (the drawer, a menu, a sheet) and no reply is coming
// in, and keeps the composer's draft. It's a plain reload: the server
// renders the page in the new theme, and WebKit holds the old frame until
// the new one paints, so the only visible change is the bar. No view
// transition: its full-screen layer covers the top edge while the new page
// arrives, and iOS keeps the bar's old color under a full-screen layer.

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
    } catch {}
    location.reload()
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
