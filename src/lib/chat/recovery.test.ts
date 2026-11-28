import { describe, expect, it } from "vitest"

import { keepPartialReply } from "@/lib/chat/recovery"

describe("keepPartialReply", () => {
  it("doesn't continue the cut-off reply, which NVIDIA can't prefill", () => {
    expect(keepPartialReply.continue).toBe(false)
  })

  it("still saves the words that arrived", () => {
    // Left unset, the SDK's default (save it) applies.
    expect(keepPartialReply.persist).not.toBe(false)
  })
})
