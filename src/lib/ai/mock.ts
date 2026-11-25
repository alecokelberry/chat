// The mock model: stands in for NVIDIA when MOCK_MODEL is "1" (e2e and, if
// you like, local dev), so tests never call NVIDIA. It streams a fixed
// reply a word at a time, about two seconds in all, ending in "Done.", so a
// test can watch it arrive and stop it partway. A message that mentions
// "markdown" gets a reply with a heading, a list, a table, a link, code and
// math instead, streamed the same way, so a test sees each half-written
// piece (an open fence, an open formula) on its way.
import type { LanguageModel } from "ai"
import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"

const REPLY =
  "This is the mock model talking. It sends one word at a time, slowly enough that a test can watch the reply stream in, press Stop partway through, and check what was kept. Done."

const MARKDOWN_REPLY = `## Some markdown

A list, with \`inline code\` and a [link](https://example.com):

- one
- two

| Name | Value |
| --- | --- |
| alpha | 1 |

\`\`\`ts
const answer: number = 42
const sentence = "a line of code long enough that it never fits a phone's column, so it scrolls"
\`\`\`

Euler's identity is \\(e^{i\\pi} + 1 = 0\\), and a coffee costs $5.

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

Done.`

export function mockModel(): LanguageModel {
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const asked = prompt.at(-1)
      const text =
        asked?.role === "user" &&
        asked.content.some(
          (part) => part.type === "text" && part.text.includes("markdown")
        )
          ? MARKDOWN_REPLY
          : REPLY
      // Each word keeps the space or newline after it.
      const words = text.split(/(?<=\s)/)
      return {
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
      }
    },
  })
}
