import { fc, it } from "@fast-check/vitest"
import { expect, test } from "vitest"

import { findSections, SECTIONS } from "@/lib/settings/sections"

const names = SECTIONS.flatMap((section) => [
  section.label,
  ...section.settings,
])

test("shows every section with nothing typed", () => {
  expect(findSections("")).toEqual(SECTIONS)
  expect(findSections("   ")).toEqual(SECTIONS)
})

it.prop([fc.constantFrom(...names), fc.boolean()])(
  "finds a section by its own name or a setting's, in any case",
  (name, upper) => {
    const query = upper ? name.toUpperCase() : name.toLowerCase()
    const found = findSections(query)
    expect(
      found.some(
        (section) => section.label === name || section.settings.includes(name)
      )
    ).toBe(true)
  }
)

test("finds Account from part of Sign out", () => {
  expect(findSections("sign").map((section) => section.id)).toEqual(["account"])
})

it.prop([fc.string({ minLength: 1, maxLength: 30 })])(
  "only ever returns sections that match, in their order",
  (query) => {
    const found = findSections(query)
    const ids = SECTIONS.map((section) => section.id)
    const positions = found.map((section) => ids.indexOf(section.id))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  }
)

test("finds nothing for words no setting has", () => {
  expect(findSections("zanzibarite")).toEqual([])
})
