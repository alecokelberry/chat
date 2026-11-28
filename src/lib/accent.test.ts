import { fc, it } from "@fast-check/vitest"
import { wcagContrast } from "culori/fn"
import { describe, expect, test, vi } from "vitest"

import {
  accentColors,
  INK,
  PRESETS,
  saveAccent,
  savedAccent,
} from "@/lib/accent"

// saveAccent's two edges, the browser's storage and <html>'s style, as
// plain stand-ins: this runs in Node.
const storage = new Map<string, string>()
vi.stubGlobal("localStorage", {
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
})
vi.stubGlobal("document", {
  documentElement: { style: { setProperty() {}, removeProperty() {} } },
})

const HEX = /^#[0-9a-f]{6}$/

/** Any sRGB color, spread across the whole cube (not clustered at 0). */
const anyHex = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map((rgb) => `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`)

describe("accentColors", () => {
  test("every preset keeps its own tuned pair, readable in both themes", () => {
    for (const preset of PRESETS) {
      expect(accentColors(preset.light)).toEqual({
        light: preset.light,
        dark: preset.dark,
      })
      expect(wcagContrast(preset.light, INK.light)).toBeGreaterThanOrEqual(3)
      expect(wcagContrast(preset.dark, INK.dark)).toBeGreaterThanOrEqual(3)
    }
  })

  it.prop([anyHex])(
    "any color comes out readable under the send button's ink, in both themes",
    (hex) => {
      const { light, dark } = accentColors(hex)
      expect(light).toMatch(HEX)
      expect(dark).toMatch(HEX)
      expect(wcagContrast(light, INK.light)).toBeGreaterThanOrEqual(3)
      expect(wcagContrast(dark, INK.dark)).toBeGreaterThanOrEqual(3)
    }
  )

  test("a color that's already readable is kept as it is", () => {
    expect(accentColors("#2563eb").light).toBe("#2563eb")
    expect(accentColors("#facc15").dark).toBe("#facc15")
  })

  test("a pale color deepens for light mode, a dark one lifts for dark mode", () => {
    expect(
      wcagContrast(accentColors("#fde68a").light, "#fde68a")
    ).toBeGreaterThan(1.5)
    expect(
      wcagContrast(accentColors("#1e3a8a").dark, "#1e3a8a")
    ).toBeGreaterThan(1.5)
  })
})

describe("savedAccent", () => {
  test("reads back what was saved", () => {
    const saved = { pick: "#2f7bf5", ...accentColors("#2f7bf5") }
    expect(savedAccent(JSON.stringify(saved))).toEqual(saved)
  })

  test("a pick saves in lowercase, and Pink however it's typed clears it", () => {
    saveAccent("#2F7BF5")
    expect(savedAccent(storage.get("accent") ?? null)?.pick).toBe("#2f7bf5")
    saveAccent("#EC4899")
    expect(storage.has("accent")).toBe(false)
  })

  test("anything else is no choice: the default pink", () => {
    for (const text of [
      null,
      "",
      "blue",
      "{",
      '{"pick":"#2f7bf5"}',
      '{"pick":"#2f7bf5","light":"red;}","dark":"#000000"}',
    ])
      expect(savedAccent(text)).toBeNull()
  })
})
