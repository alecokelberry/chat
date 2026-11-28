import { fc, it } from "@fast-check/vitest"
import { expect, test } from "vitest"

import { MODELS } from "@/lib/ai/models"
import { splitUsage } from "@/lib/settings/usage-split"

const keys = MODELS.map((model) => model.key)
const rows = fc.uniqueArray(
  fc.record({
    model: fc.constantFrom(...keys, "retired-model"),
    replies: fc.integer({ min: 0, max: 1_000_000 }),
    tokens: fc.integer({ min: 0, max: 2_000_000_000 }),
  }),
  { selector: (row) => row.model, maxLength: 6 }
)

test("nothing used is an empty split", () => {
  expect(splitUsage([])).toEqual({ replies: 0, tokens: 0, parts: [] })
})

test("each model's share of the tokens, in the picker's model order", () => {
  const split = splitUsage([
    { model: "lightning", replies: 1, tokens: 250 },
    { model: "super", replies: 3, tokens: 750 },
  ])
  expect(split.tokens).toBe(1000)
  expect(split.replies).toBe(4)
  expect(split.parts.map((part) => [part.key, part.percent])).toEqual([
    ["super", 75],
    ["lightning", 25],
  ])
})

it.prop([rows])(
  "each share is its exact percent rounded, and none is for an unused model",
  (used) => {
    const { parts, tokens } = splitUsage(used)
    if (tokens === 0) {
      expect(parts).toEqual([])
      return
    }
    for (const part of parts) {
      expect(Number.isInteger(part.percent)).toBe(true)
      expect(
        Math.abs(part.percent - (part.tokens / tokens) * 100)
      ).toBeLessThanOrEqual(0.5)
      expect(part.tokens).toBeGreaterThan(0)
    }
  }
)

it.prop([rows])("every token and reply is counted once", (used) => {
  const split = splitUsage(used)
  const sum = (key: "tokens" | "replies") =>
    used.reduce((total, row) => total + row[key], 0)
  expect(split.tokens).toBe(sum("tokens"))
  expect(split.replies).toBe(sum("replies"))
})

test("models that used the same show the same share", () => {
  const split = splitUsage([
    { model: "super", replies: 1, tokens: 1 },
    { model: "ultra", replies: 1, tokens: 1 },
    { model: "lightning", replies: 1, tokens: 1 },
  ])
  expect(split.parts.map((part) => part.percent)).toEqual([33, 33, 33])
})

test("a model keeps its color whichever others were used", () => {
  const alone = splitUsage([{ model: "lightning", replies: 1, tokens: 5 }])
  const shared = splitUsage([
    { model: "super", replies: 1, tokens: 5 },
    { model: "lightning", replies: 1, tokens: 5 },
    { model: "retired-model", replies: 1, tokens: 5 },
  ])
  expect(alone.parts.map((part) => part.slot)).toEqual([4])
  expect(shared.parts.map((part) => [part.key, part.slot])).toEqual([
    ["super", 1],
    ["lightning", 4],
    ["other", 7],
  ])
})
