import { fc, it } from "@fast-check/vitest"
import { expect, test } from "vitest"

import { LIBRARY_ORDERS } from "@/lib/chat/library-items"
import { LIBRARY_VIEWS, lookIn } from "@/lib/library-view"

test("no cookie is Grok's default: a grid, newest first", () => {
  expect(lookIn("")).toEqual({ view: "grid", order: "newest" })
})

it.prop([
  fc.constantFrom(...LIBRARY_VIEWS),
  fc.constantFrom(...LIBRARY_ORDERS),
  fc.string(),
])("reads back what was saved, among other cookies", (view, order, other) => {
  const name = other.replaceAll(/[^a-z]/g, "") || "x"
  expect(lookIn(`${name}=1; library=${view}.${order}; theme=dark`)).toEqual({
    view,
    order,
  })
})

it.prop([fc.string()])("anything else falls back to the default", (junk) => {
  const look = lookIn(`library=${junk}`)
  expect(LIBRARY_VIEWS).toContain(look.view)
  expect(LIBRARY_ORDERS).toContain(look.order)
})
