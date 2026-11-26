// The theme's sun and moon in one grid cell, swapped with a spin and scale
// by the dark variant (data-color-scheme on <html>, set before the first
// paint), not React state, so nothing animates on load. Only the spin is
// eased, over duration-spin; reduced motion swaps them at once. The visible
// icon carries no transform at rest (an identity transform leaves a layer
// iOS rasterizes soft); only the hidden one is scaled and turned.
import { MoonIcon, SunIcon } from "lucide-react"

function ThemeIcon() {
  return (
    <span
      data-slot="theme-icon"
      className="grid *:col-start-1 *:row-start-1 *:transition-spin motion-reduce:*:transition-none"
    >
      <SunIcon
        aria-hidden
        className="dark:scale-50 dark:-rotate-90 dark:opacity-0"
      />
      <MoonIcon
        aria-hidden
        className="scale-50 rotate-90 opacity-0 dark:scale-none dark:rotate-none dark:opacity-100"
      />
    </span>
  )
}

export { ThemeIcon }
