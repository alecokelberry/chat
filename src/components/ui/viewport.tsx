// Viewport: follows what's on screen with ui-sdk's bindViewport, so CSS
// can size against it. <html> gets --visual-viewport-height (it shrinks
// above the iPhone keyboard, which svh and dvh don't) and data-keyboard
// while the keyboard is open. ui-sdk ships bindViewport only from its
// root entry. Rendered once, by the root document.
import { bindViewport } from "@ui-sdk/core"
import { useEffect } from "react"

export function Viewport() {
  useEffect(() => bindViewport(document.documentElement), [])
  return null
}
