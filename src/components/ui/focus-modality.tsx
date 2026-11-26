// Focus rings follow the keyboard: a click or tap marks the page
// data-pointer, and Tab or an arrow key (outside a text field) clears it. The focus-visible and
// keyboard variants (app.css) check it, so a tap never rings what it
// touched (the composer above all), and a shortcut after a click doesn't
// ring whatever was clicked last. Rendered once, by the root document.
import { useEffect } from "react"

const NAV_KEYS = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
])

export function FocusModality() {
  useEffect(() => {
    const root = document.documentElement
    const onPointer = () => root.setAttribute("data-pointer", "")
    // Arrows and Home/End inside a text field move its caret, not focus:
    // fixing a typo in the composer mustn't ring it.
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        event.target.matches("input, textarea, [contenteditable='true']")
      if (event.key === "Tab" || (NAV_KEYS.has(event.key) && !typing))
        root.removeAttribute("data-pointer")
    }
    window.addEventListener("pointerdown", onPointer, true)
    window.addEventListener("keydown", onKey, true)
    return () => {
      window.removeEventListener("pointerdown", onPointer, true)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [])
  return null
}
