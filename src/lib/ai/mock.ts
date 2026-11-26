// The mock model: stands in for NVIDIA when MOCK_MODEL is "1" (e2e and, if
// you like, local dev), so tests never call NVIDIA. It waits half a second
// before the first word, so a test sees the waiting marker, then streams a
// fixed reply a word at a time, under three seconds in all (five with
// thinking), ending in "Done.", so a test can watch it arrive and stop it
// partway. The reply opens by saying which model id it stands in for and
// whether the request turned thinking on, so a test can check what a real
// call would have asked NVIDIA for. With thinking on, it first thinks
// aloud (REASONING), streamed the same way, as NVIDIA streams
// reasoning_content. A message that mentions "markdown" gets a reply with
// a heading, a list, a table, a link, code and math instead, streamed the
// same way, so a test sees each half-written piece (an open fence, an open
// formula) on its way. A message ending in "(busy N)" gets a 429 for its
// first N calls, as a busy NVIDIA answers, so a test can watch the quiet
// retry and the error after it. One ending in "(silent N)" gets no answer
// at all for its first N calls, as a hung NVIDIA does, and one that
// mentions "(stalls)" stops after a few words and never ends, so a test
// can watch the silence limit (src/lib/ai/silence.ts) end each. A message
// that mentions "burst" gets
// BURSTS, three big chunks 600ms apart, as NVIDIA often sends them, so a
// test can watch the browser pace them out (src/lib/chat/smooth-text.ts).
// Asked for a chat's title (generateText), it answers "Talking to the mock
// model" at once.
import { APICallError, simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"

type LanguageModelV4StreamPart =
  Awaited<
    ReturnType<MockLanguageModelV4["doStream"]>
  >["stream"] extends ReadableStream<infer Part>
    ? Part
    : never

export const REPLY =
  "It sends one word at a time, slowly enough that a test can watch the reply stream in, press Stop partway through, and check what was kept. Done."

const REASONING =
  "The mock model is thinking it over, a word at a time, so a test sees the step say Thinking… and then how long it took."

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

// A message that mentions "long code" gets a block of 20 lines, so a test
// sees it fold.
const LONG_CODE_REPLY = `Here is a long one:

\`\`\`ts
${Array.from({ length: 20 }, (_, i) => `const line${i + 1} = ${i + 1}`).join("\n")}
\`\`\`

Done.`

/** A reply in three bursts of whole words. */
export const BURSTS = [
  "This reply arrives in bursts, ",
  "a dozen words at a time with a pause between each, ",
  "the way a busy model often sends them. Done.",
]

/** Each word keeps the space or newline after it. */
const wordsOf = (line: string) => line.split(/(?<=\s)/)

/** The mock's reply to a message (wordsOf splits it for streaming). */
const replyTo = (message: string, modelId: string, thinking: boolean) =>
  message.includes("long code")
    ? LONG_CODE_REPLY
    : message.includes("markdown")
      ? MARKDOWN_REPLY
      : `This is the mock model talking, as ${modelId} with thinking ${thinking ? "on" : "off"}. ${REPLY}`

/** Whether a request's chat template options turn thinking on. */
const thinks = (kwargs: unknown) =>
  typeof kwargs === "object" &&
  kwargs !== null &&
  "enable_thinking" in kwargs &&
  kwargs.enable_thinking === true

const BUSY = /\(busy (\d+)\)/
const SILENT = /\(silent (\d+)\)/

/** Calls already taken, per pattern and message. Lives as long as the
 *  isolate: each test sends a message of its own. */
const taken = new Map<string, number>()

/** Whether this call is one of the first N a message's "(word N)" asks
 *  for, counting it if so. */
function takeCall(pattern: RegExp, message: string) {
  const match = pattern.exec(message)
  if (match === null) return false
  const key = `${pattern.source}\n${message}`
  const count = taken.get(key) ?? 0
  if (count >= Number(match[1])) return false
  taken.set(key, count + 1)
  return true
}

/** Throws NVIDIA's 429 while this message's busy calls last. */
function refuseIfBusy(message: string) {
  if (!takeCall(BUSY, message)) return
  throw new APICallError({
    message: "Too Many Requests",
    url: "https://mock.invalid/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 429,
    isRetryable: true,
  })
}

/** Never answers: the request hangs until it's cancelled. */
const hang = (signal: AbortSignal | undefined) =>
  new Promise<never>((_, reject) =>
    signal?.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    })
  )

/** A few words, then nothing, and no end. */
const stall = () =>
  new ReadableStream<LanguageModelV4StreamPart>({
    start(controller) {
      controller.enqueue({ type: "text-start", id: "reply" })
      for (const delta of wordsOf(REPLY).slice(0, 5))
        controller.enqueue({ type: "text-delta", id: "reply", delta })
    },
  })

/** The failure a message asks for, if any: NVIDIA's 429 (thrown), a call
 *  that never answers, or a reply that stops partway. */
function failureFor(message: string, abortSignal: AbortSignal | undefined) {
  refuseIfBusy(message)
  if (takeCall(SILENT, message)) return hang(abortSignal)
  if (message.includes("(stalls)")) return { stream: stall() }
  return undefined
}

/** What the mock names every chat. */
const TITLE = "Talking to the mock model"

export function mockModel(modelId: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({
      content: [{ type: "text", text: TITLE }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 0,
          noCache: 0,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 5, text: 5, reasoning: undefined },
      },
      warnings: [],
    }),
    doStream: async ({ prompt, providerOptions, abortSignal }) => {
      const asked = prompt.at(-1)
      const message =
        asked?.role === "user"
          ? asked.content
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("")
          : ""
      const failure = failureFor(message, abortSignal)
      if (failure !== undefined) return failure
      const thinking = thinks(providerOptions?.nvidia?.chat_template_kwargs)
      const bursty = message.includes("burst")
      const words = bursty
        ? BURSTS
        : wordsOf(replyTo(message, modelId, thinking))
      const thoughts = thinking ? wordsOf(REASONING) : []
      return {
        stream: simulateReadableStream({
          initialDelayInMs: 500,
          chunkDelayInMs: bursty ? 600 : 60,
          chunks: [
            ...(thinking
              ? [
                  { type: "reasoning-start" as const, id: "thinking" },
                  ...thoughts.map((delta) => ({
                    type: "reasoning-delta" as const,
                    id: "thinking",
                    delta,
                  })),
                  { type: "reasoning-end" as const, id: "thinking" },
                ]
              : []),
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
                  total: thoughts.length + words.length,
                  text: words.length,
                  reasoning: thoughts.length,
                },
              },
            },
          ],
        }),
      }
    },
  })
}
