import { fc, it } from "@fast-check/vitest"
import { describe, expect } from "vitest"

import { advanceReveal, revealedText } from "@/lib/chat/smooth-text"

/** Reply-like text: words of 1 to 40 letters, evenly spread so long
 *  ones (past the 24-letter cut-off for showing a word in pieces) are
 *  common, between spaces and line breaks. */
const reply = fc
  .array(
    fc.oneof(
      fc.integer({ min: 1, max: 40 }).chain((length) =>
        fc.string({
          unit: fc.constantFrom("a", "b", "é"),
          minLength: length,
          maxLength: length,
        })
      ),
      fc.constantFrom(" ", "\n", "  ", " \n")
    ),
    { maxLength: 60 }
  )
  .map((parts) => parts.join(""))

const textAndPosition = reply.chain((text) =>
  fc.tuple(
    fc.constant(text),
    // Whole numbers plus a fraction: fc.double alone mostly picks values
    // near 0, which would never land inside a word.
    fc
      .tuple(
        fc.integer({ min: -2, max: text.length + 2 }),
        fc.integer({ min: 0, max: 99 })
      )
      .map(([whole, hundredths]) => whole + hundredths / 100)
  )
)

/** The run of non-space characters around index `at`. */
function wordAround(text: string, at: number) {
  const before = /\S*$/.exec(text.slice(0, at))?.[0] ?? ""
  const after = /^\S*/.exec(text.slice(at))?.[0] ?? ""
  return before + after
}

describe("revealedText", () => {
  it.prop([textAndPosition])(
    "shows a start of the text, at least up to the position",
    ([text, position]) => {
      const shown = revealedText(text, position)
      expect(text.startsWith(shown)).toBe(true)
      const floor = Math.min(text.length, Math.max(0, Math.floor(position)))
      expect(shown.length).toBeGreaterThanOrEqual(floor)
    }
  )

  it.prop([textAndPosition])(
    "never cuts a word, unless it's longer than 24 letters",
    ([text, position]) => {
      const shown = revealedText(text, position)
      const next = text[shown.length]
      if (shown.length === 0 || next === undefined || /\s/.test(next)) return
      expect(wordAround(text, shown.length).length).toBeGreaterThan(24)
    }
  )

  it.prop([textAndPosition, fc.integer({ min: 0, max: 50 })])(
    "never shows less as the position moves on",
    ([text, position], further) => {
      expect(revealedText(text, position).length).toBeLessThanOrEqual(
        revealedText(text, position + further).length
      )
    }
  )
})

describe("advanceReveal", () => {
  // A backlog under 40 characters is where the 160-a-second floor, not
  // the quarter-second catch-up, sets the pace.
  const step = fc
    .tuple(
      fc.nat({ max: 5000 }),
      fc.oneof(fc.nat({ max: 40 }), fc.nat({ max: 5000 })),
      fc.integer({ min: 0, max: 1000 })
    )
    .map(([position, backlog, ms]) => ({
      position,
      length: position + backlog,
      ms,
    }))

  it.prop([step])(
    "moves forward, never past the text, at 160 characters a second or faster",
    ({ position, length, ms }) => {
      const next = advanceReveal(position, length, ms)
      expect(next).toBeGreaterThanOrEqual(position)
      expect(next).toBeLessThanOrEqual(length)
      expect(next).toBeGreaterThanOrEqual(
        Math.min(length, position + (160 * ms) / 1000) - 1e-9
      )
    }
  )

  it.prop([fc.nat({ max: 20_000 })])(
    "catches up with any backlog within a quarter second",
    (length) => {
      expect(advanceReveal(0, length, 250)).toBe(length)
    }
  )

  it.prop([fc.nat(), fc.nat(), fc.integer({ min: 0, max: 1000 })])(
    "jumps to the end once there is nothing left to reveal",
    (a, b, ms) => {
      const [length, position] = [Math.min(a, b), Math.max(a, b)]
      expect(advanceReveal(position, length, ms)).toBe(length)
    }
  )
})
