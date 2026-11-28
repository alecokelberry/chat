// The accent color (the `send` token: the send button, New Chat's plus,
// the sign-in go circle, selection), chosen in Settings › Appearance from
// eight presets or any color through the picker. Each choice becomes a
// pair, one color per theme, each readable under the send button's own
// ink (WCAG 1.4.11, 3:1): a preset's pair is tuned by hand, and any other
// color keeps its hue and chroma while its OKLCH lightness moves just far
// enough (darker for light mode's white ink, lighter for dark mode's dark
// ink). The pair is saved in this browser beside its pick, as Theme is,
// and ACCENT_SCRIPT puts it on <html> before the first paint, as
// --accent-light and --accent-dark, which app.css's `--send` reads; with
// nothing saved, `--send` keeps its own pink. ACCENT_SCRIPT sits in
// src/lib/theme.ts, so the page's first load doesn't carry the color
// math.
import {
  clampChroma,
  formatHex,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeRgb,
  useMode as registerMode,
  wcagContrast,
  type Oklch,
} from "culori/fn"
import * as z from "zod/mini"

import { ACCENT_KEY } from "@/lib/theme"

// culori/fn loads only the color spaces asked for: sRGB, OKLCH and the
// two it converts through (linear sRGB, OKLab). Its `useMode` registers
// one (not a React hook), so it's renamed here.
registerMode(modeRgb)
registerMode(modeLrgb)
registerMode(modeOklab)
const oklch = registerMode(modeOklch)

/** The send button's ink in each theme (app.css's --primary-foreground). */
export const INK = { light: "#fefefc", dark: "#1e1d1d" } as const

/** The least contrast the accent keeps against that ink. */
const MIN_CONTRAST = 3

export const PRESETS = [
  { name: "Pink", light: "#ec4899", dark: "#f15aa6" },
  { name: "Red", light: "#e5484d", dark: "#ff6369" },
  { name: "Orange", light: "#e5590a", dark: "#ff8b3e" },
  { name: "Green", light: "#1f9d55", dark: "#3dd68c" },
  { name: "Teal", light: "#0d9488", dark: "#2dd4bf" },
  { name: "Blue", light: "#2f7bf5", dark: "#5c9dff" },
  { name: "Indigo", light: "#6366f1", dark: "#8b8dff" },
  { name: "Purple", light: "#9b51e0", dark: "#bf7af0" },
] as const

export const DEFAULT_ACCENT = PRESETS[0].light

type Scheme = keyof typeof INK
export type AccentColors = Record<Scheme, string>

/** `pick` as a readable pair: a preset's own, or `pick` moved only as far
 *  as each theme needs. */
export function accentColors(pick: string): AccentColors {
  const preset = PRESETS.find((p) => p.light === pick.toLowerCase())
  if (preset) return { light: preset.light, dark: preset.dark }
  return { light: readable(pick, "light"), dark: readable(pick, "dark") }
}

/** `color` at the lightness nearest its own that reads under `scheme`'s
 *  ink, found by halving: light mode searches down toward black, dark
 *  mode up toward white, and both ends always read. */
function readable(color: string, scheme: Scheme): string {
  const start = oklch(color)
  if (!start) return PRESETS[0][scheme]
  const at = (l: number) =>
    formatHex(clampChroma({ ...start, l } satisfies Oklch, "oklch"))
  const reads = (hex: string) => wcagContrast(hex, INK[scheme]) >= MIN_CONTRAST
  const own = at(start.l)
  if (reads(own)) return own
  let [near, far] = scheme === "light" ? [start.l, 0] : [start.l, 1]
  for (let step = 0; step < 24; step++) {
    const middle = (near + far) / 2
    if (reads(at(middle))) far = middle
    else near = middle
  }
  return at(far)
}

// zod/mini, the tree-shaken build, since this runs in the browser.
const hex = z.string().check(z.regex(/^#[0-9a-f]{6}$/))
const Saved = z.object({ pick: hex, light: hex, dark: hex })

export type SavedAccent = z.infer<typeof Saved>

/** What localStorage holds, if it's a choice; anything else is none. */
export function savedAccent(text: string | null): SavedAccent | null {
  try {
    return Saved.parse(JSON.parse(text ?? ""))
  } catch {
    return null
  }
}

/** Saves `pick` in this browser and applies it; the default pink clears
 *  it, so the page goes back to app.css's own. */
export function saveAccent(color: string) {
  // One spelling, so Pink is the default however it's typed, and the
  // saved pick passes savedAccent's check.
  const pick = color.toLowerCase()
  const colors = accentColors(pick)
  const isDefault = pick === DEFAULT_ACCENT
  try {
    if (isDefault) localStorage.removeItem(ACCENT_KEY)
    else localStorage.setItem(ACCENT_KEY, JSON.stringify({ pick, ...colors }))
  } catch {
    // Private mode or full storage: it still applies for this visit.
  }
  applyAccent(isDefault ? null : colors)
}

/** Puts a pair on <html>, or takes it off for the default pink. */
export function applyAccent(colors: AccentColors | null) {
  const style = document.documentElement.style
  for (const scheme of ["light", "dark"] as const) {
    if (colors) style.setProperty(`--accent-${scheme}`, colors[scheme])
    else style.removeProperty(`--accent-${scheme}`)
  }
}
