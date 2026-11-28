import { expect, it } from "vitest"

import { answeredBy } from "@/lib/chat/reply-metadata"

it("says a reply under a second took <1s, never 0.0s", () => {
  expect(answeredBy({ model: "ultra", ms: 40 })).toBe("Ultra · <1s")
  expect(answeredBy({ model: "ultra", ms: 999 })).toBe("Ultra · <1s")
  expect(answeredBy({ model: "ultra", ms: 1000 })).toBe("Ultra · 1.0s")
})
