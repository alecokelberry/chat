import { fc, it } from "@fast-check/vitest"
import { describe, expect, test } from "vitest"

import { nextSection } from "@/lib/chat/next-section"

const sections = [["a1", "a2"], [], ["b1"], ["c1", "c2"]]

describe("nextSection", () => {
  test("moves to the next section's first row, skipping empty ones", () => {
    expect(nextSection(sections, "a2", 1)).toBe("b1")
    expect(nextSection(sections, "b1", 1)).toBe("c1")
  })

  test("wraps around both ways", () => {
    expect(nextSection(sections, "c2", 1)).toBe("a1")
    expect(nextSection(sections, "a1", -1)).toBe("c1")
  })

  test("starts at the first section, or the last going back, with nothing highlighted", () => {
    expect(nextSection(sections, null, 1)).toBe("a1")
    expect(nextSection(sections, null, -1)).toBe("c1")
    expect(nextSection([["only"]], null, -1)).toBe("only")
  })

  test("has nowhere to go with no rows", () => {
    expect(nextSection([[], []], null, 1)).toBeUndefined()
  })

  it.prop([
    fc.array(fc.array(fc.string(), { maxLength: 4 }), { maxLength: 6 }),
    fc.option(fc.string()),
    fc.constantFrom<1 | -1>(1, -1),
  ])("always lands on a section's first row", (all, value, step) => {
    const next = nextSection(all, value, step)
    const firsts = all.flatMap((section) => section.slice(0, 1))
    if (firsts.length === 0) expect(next).toBeUndefined()
    else expect(firsts).toContain(next)
  })
})
