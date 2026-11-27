import { fc, it } from "@fast-check/vitest"
import { expect, test } from "vitest"

import { initialsOf } from "@/lib/settings/initials"

test("takes the first and last words' first letters", () => {
  expect(initialsOf("Alec Okelberry")).toBe("AO")
  expect(initialsOf("ada byron lovelace")).toBe("AL")
  expect(initialsOf("  Dev  ")).toBe("D")
  expect(initialsOf("")).toBe("")
})

test("keeps a letter outside the BMP whole", () => {
  expect(initialsOf("𝒜da 𝒮mith")).toBe("𝒜𝒮")
})

it.prop([fc.array(fc.string({ unit: "grapheme" }), { maxLength: 6 })])(
  "is at most two characters, never splitting one",
  (words) => {
    const initials = initialsOf(words.join(" "))
    expect(Array.from(initials).length).toBeLessThanOrEqual(2)
    expect(initials.isWellFormed()).toBe(true)
  }
)
