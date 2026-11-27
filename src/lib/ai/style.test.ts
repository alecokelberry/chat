import { fc, it } from "@fast-check/vitest"
import { expect, test } from "vitest"

import {
  CUSTOM_MAX,
  isResponseStyle,
  RESPONSE_STYLES,
  styleInstruction,
  toCustomize,
} from "@/lib/ai/style"

test("Default adds nothing", () => {
  expect(styleInstruction({ style: "default", custom: "Be brief" })).toBe(
    undefined
  )
})

test("each preset adds its own line, naming itself", () => {
  for (const style of RESPONSE_STYLES) {
    if (style === "default" || style === "custom") continue
    const line = styleInstruction({ style, custom: "" })
    expect(line).toMatch(new RegExp(style, "i"))
  }
})

test("Custom adds the user's own words as their preferences", () => {
  const line = styleInstruction({
    style: "custom",
    custom: "Answer in French.",
  })
  expect(line).toContain("Answer in French.")
  expect(line).toMatch(/preferences/i)
})

test("Custom with nothing written adds nothing", () => {
  expect(styleInstruction({ style: "custom", custom: "  \n " })).toBe(undefined)
})

it.prop([fc.string({ maxLength: CUSTOM_MAX * 3 })])(
  "never passes on more than CUSTOM_MAX characters of custom text",
  (custom) => {
    const line = styleInstruction({ style: "custom", custom }) ?? ""
    const kept = custom.trim().slice(0, CUSTOM_MAX)
    expect(line.length).toBeLessThanOrEqual(CUSTOM_MAX + 200)
    if (kept !== "") expect(line).toContain(kept)
  }
)

it.prop([fc.string()])("an unknown style is read as Default", (style) => {
  fc.pre(!isResponseStyle(style))
  const customize = toCustomize({ style, custom: "x" })
  expect(customize.style).toBe("default")
  expect(styleInstruction(customize)).toBe(undefined)
})
