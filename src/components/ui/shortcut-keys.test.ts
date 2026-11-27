import { fc, it } from "@fast-check/vitest"
import { formatShortcut } from "@ui-sdk/react/shortcuts"
import { expect, test } from "vitest"

import { shortcutKeys } from "@/components/ui/shortcut-keys"

test("splits a Mac shortcut into its symbols and its key", () => {
  expect(shortcutKeys(formatShortcut("mod+k", true))).toEqual(["⌘", "K"])
  expect(shortcutKeys(formatShortcut("mod+shift+enter", true))).toEqual([
    "⌘",
    "⇧",
    "↩",
  ])
})

test("splits a shortcut elsewhere at its pluses", () => {
  expect(shortcutKeys(formatShortcut("mod+k", false))).toEqual(["Ctrl", "K"])
  expect(shortcutKeys(formatShortcut("mod+,", false))).toEqual(["Ctrl", ","])
})

test("leaves a word key whole", () => {
  expect(shortcutKeys(formatShortcut("tab", false))).toEqual(["Tab"])
  expect(shortcutKeys(formatShortcut("d", true))).toEqual(["D"])
  expect(shortcutKeys("")).toEqual([])
})

const modifiers = fc.subarray(["mod", "shift", "alt"])
const key = fc.constantFrom(
  ..."abcdefghijklmnopqrstuvwxyz0123456789,./;[]-=?".split(""),
  "enter",
  "tab",
  "escape",
  "backspace",
  "arrowup",
  "f12"
)

it.prop([modifiers, key, fc.boolean()])(
  "has one chip per key, and they read back as the hint",
  (mods, last, apple) => {
    const text = formatShortcut([...mods, last].join("+"), apple)
    const keys = shortcutKeys(text)
    expect(keys).toHaveLength(mods.length + 1)
    expect(keys.join(apple ? "" : "+")).toBe(
      text.replace(/[\u2066-\u2069]/g, "")
    )
  }
)
