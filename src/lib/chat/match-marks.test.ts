import { fc, it } from "@fast-check/vitest"
import { expect, test } from "vitest"

import { MATCH_END, MATCH_START, marksOf } from "@/lib/chat/match-marks"

// Text as indexed: anything but the two marker characters.
const plain = fc
  .string()
  .map((text) => text.replaceAll(MATCH_START, "").replaceAll(MATCH_END, ""))
const pieces = fc.array(fc.record({ text: plain, match: fc.boolean() }))

const snippetOf = (parts: { text: string; match: boolean }[]) =>
  parts
    .map(({ text, match }) => (match ? MATCH_START + text + MATCH_END : text))
    .join("")

test("marks each matched word and keeps the text around it", () => {
  expect(marksOf(`a ${MATCH_START}cat${MATCH_END} sat`)).toEqual([
    { text: "a ", match: false },
    { text: "cat", match: true },
    { text: " sat", match: false },
  ])
})

it.prop([pieces])("its pieces put back are the snippet's text", (parts) => {
  const text = marksOf(snippetOf(parts))
    .map((piece) => piece.text)
    .join("")
  expect(text).toBe(parts.map((part) => part.text).join(""))
})

it.prop([pieces])("marks exactly the matched words, in order", (parts) => {
  const marked = marksOf(snippetOf(parts))
    .filter((piece) => piece.match)
    .map((piece) => piece.text)
  expect(marked).toEqual(
    parts.filter((part) => part.match && part.text !== "").map((p) => p.text)
  )
})

it.prop([pieces])("never returns an empty piece", (parts) => {
  expect(marksOf(snippetOf(parts)).every((piece) => piece.text !== "")).toBe(
    true
  )
})
