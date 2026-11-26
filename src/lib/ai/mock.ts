// The mock model: stands in for NVIDIA when MOCK_MODEL is "1" (e2e and, if
// you like, local dev), so tests never call NVIDIA. It waits half a second
// before the first word, so a test sees the waiting marker, then streams a
// fixed reply a word at a time, under three seconds in all, ending in
// "Done.", so a test can watch it arrive and stop it partway. The reply
// opens by saying which model id it stands in for and whether the request
// turned thinking on, so a test can check what a real call would have
// asked NVIDIA for. A message that mentions "markdown" gets a reply with a
// heading, a list, a table, a link, code and
// math instead, streamed the same way, so a test sees each half-written
// piece (an open fence, an open formula) on its way.
import type { LanguageModel } from "ai"
import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"

const REPLY =
  "It sends one word at a time, slowly enough that a test can watch the reply stream in, press Stop partway through, and check what was kept. Done."

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

/** Whether a request's chat template options turn thinking on. */
const thinks = (kwargs: unknown) =>
  typeof kwargs === "object" &&
  kwargs !== null &&
  "enable_thinking" in kwargs &&
  kwargs.enable_thinking === true

export function mockModel(modelId: string): LanguageModel {
  return new MockLanguageModelV4({
    modelId,
    doStream: async ({ prompt, providerOptions }) => {
      const asked = prompt.at(-1)
      const text =
        asked?.role === "user" &&
        asked.content.some(
          (part) => part.type === "text" && part.text.includes("markdown")
        )
          ? MARKDOWN_REPLY
          : `This is the mock model talking, as ${modelId} with thinking ${thinks(providerOptions?.nvidia?.chat_template_kwargs) ? "on" : "off"}. ${REPLY}`
      // Each word keeps the space or newline after it.
      const words = text.split(/(?<=\s)/)
      return {
        stream: simulateReadableStream({
          initialDelayInMs: 500,
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
