// Press feedback that starts when the finger lands. iOS paints :active late
// (later still inside a scroller, while it decides whether you're
// scrolling) and clears it the moment you lift, so a quick tap showed no
// press at all and read as lag. On pointerdown this marks the pressed
// control data-pressing, which the active: variant and `press` also match
// (app.css), and keeps it for at least MIN_MS so a tap is seen. A scroll
// that takes over (pointercancel) or a drag away clears it. Rendered once,
// by the root document.
import { useEffect } from "react"

const CONTROL =
  'button, a[href], [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="tab"], label[for]'
const DISABLED = ':disabled, [aria-disabled="true"], [data-disabled]'
const MIN_MS = 90
/** How far a finger can slide off the control before it lets go. */
const SLOP = 12

export function PressFeedback() {
  useEffect(() => {
    let pressed: HTMLElement | null = null
    let box: DOMRect | null = null
    let since = 0
    // A control let go of less than MIN_MS after it was pressed, still
    // showing its press until the timer clears it.
    let lifting: HTMLElement | null = null
    let timer = 0

    const clear = () => {
      window.clearTimeout(timer)
      lifting?.removeAttribute("data-pressing")
      lifting = null
    }

    const release = () => {
      const el = pressed
      if (el === null) return
      pressed = null
      const left = MIN_MS - (performance.now() - since)
      if (left <= 0) {
        el.removeAttribute("data-pressing")
        return
      }
      lifting = el
      timer = window.setTimeout(clear, left)
    }

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const el =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(CONTROL)
          : null
      if (el === null || el.matches(DISABLED)) return
      clear()
      pressed?.removeAttribute("data-pressing")
      pressed = el
      box = el.getBoundingClientRect()
      since = performance.now()
      el.setAttribute("data-pressing", "")
    }

    // A finger that slides off the control lets it go, like a native button.
    const onMove = (event: PointerEvent) => {
      if (pressed === null || box === null) return
      if (
        event.clientX < box.left - SLOP ||
        event.clientX > box.right + SLOP ||
        event.clientY < box.top - SLOP ||
        event.clientY > box.bottom + SLOP
      )
        release()
    }

    const opts = { capture: true, passive: true }
    window.addEventListener("pointerdown", onDown, opts)
    window.addEventListener("pointermove", onMove, opts)
    window.addEventListener("pointerup", release, opts)
    window.addEventListener("pointercancel", release, opts)
    window.addEventListener("blur", release)
    return () => {
      window.removeEventListener("pointerdown", onDown, opts)
      window.removeEventListener("pointermove", onMove, opts)
      window.removeEventListener("pointerup", release, opts)
      window.removeEventListener("pointercancel", release, opts)
      window.removeEventListener("blur", release)
      clear()
      pressed?.removeAttribute("data-pressing")
    }
  }, [])
  return null
}
