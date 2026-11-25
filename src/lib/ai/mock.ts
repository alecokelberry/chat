// The mock model: stands in for NVIDIA when MOCK_MODEL is "1" (e2e and, if
// you like, local dev), so tests never call NVIDIA. It streams a fixed
// reply a word at a time, about two seconds in all, ending in "Done.", so a
// test can watch it arrive and stop it partway.
import type { LanguageModel } from "ai"
import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"

const REPLY =
  "This is the mock model talking. It sends one word at a time, slowly enough that a test can watch the reply stream in, press Stop partway through, and check what was kept. Done."

export function mockModel(): LanguageModel {
  const words = REPLY.split(" ").map((word, index) =>
    index === 0 ? word : ` ${word}`
  )
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: 100,
        chunkDelayInMs: 60,
        chunks: [
          { type: "text-start", id: "reply" },
          ...words.map((delta) => ({
            type: "text-delta" as const,
            id: "reply",
            delta,
          })),
          { type: "text-end", id: "reply" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: {
                total: 0,
                noCache: 0,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: {
                total: words.length,
                text: words.length,
                reasoning: undefined,
              },
            },
          },
        ],
      }),
    }),
  })
}
