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
//
// A message that mentions "search" makes it call the webSearch tool first
// (src/lib/ai/search.ts), with the message as the query, and answer once
// the results are in; "(search N)" asks for N searches in a row, so a test
// sees the reply's cap stop it. Under MOCK_MODEL the tool itself answers
// with mockSearch's canned results after a second and a half, so a test
// sees the step run and can Stop it; a query with "(search down)" fails,
// as Keenable does when it's down.
import { APICallError, simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"

import type { SearchResult } from "@/lib/ai/search"

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

/** The reply after a search. */
export const SEARCHED_REPLY =
  "The mock model searched the web and read what it found. Done."

/** The reply after a search that failed. */
export const SEARCH_FAILED_REPLY =
  "The mock model couldn't search the web just now, so this comes from what it already knows. Done."

/** Five canned results, each from its own site, the last with a long
 *  address. */
export const SEARCH_RESULTS: SearchResult[] = [
  {
    title: "Example Domain",
    url: "https://example.com/",
    site: "example.com",
  },
  {
    title: "Mock news of the day",
    url: "https://news.example.org/today",
    site: "news.example.org",
  },
  {
    title: "Wikipedia: Mock object",
    url: "https://en.wikipedia.org/wiki/Mock_object",
    site: "en.wikipedia.org",
  },
  {
    title: "MDN: Fetch API",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API",
    site: "developer.mozilla.org",
  },
  {
    title: "A page with a very long address",
    url: "https://a-very-long-subdomain-name-for-testing.example.net/with/a/long/path?and=query",
    site: "a-very-long-subdomain-name-for-testing.example.net",
  },
].map((result) => ({
  ...result,
  snippet: `What ${result.site} says, in a sentence or two.`,
}))

/** The mock's search: SEARCH_RESULTS after a second and a half, or a
 *  failure for a query with "(search down)". Stop cancels it. */
export async function mockSearch(
  query: string,
  abortSignal: AbortSignal | undefined
): Promise<SearchResult[]> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 1500)
    abortSignal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(abortSignal.reason)
      },
      { once: true }
    )
  })
  if (query.includes("(search down)")) throw new Error("Keenable is down")
  return SEARCH_RESULTS
}

type Prompt = Parameters<MockLanguageModelV4["doStream"]>[0]["prompt"]

const SEARCHES = /\(search (\d+)\)/

/** The last question, and the searches made for it so far: how many, and
 *  whether one failed. */
function askedOf(prompt: Prompt) {
  const at = prompt.findLastIndex((m) => m.role === "user")
  let searched = 0
  let searchFailed = false
  for (const step of prompt.slice(at + 1)) {
    if (step.role !== "assistant" && step.role !== "tool") continue
    for (const part of step.content) {
      if (part.type === "tool-call" && part.toolName === "webSearch")
        searched += 1
      if (part.type === "tool-result" && part.output.type.startsWith("error"))
        searchFailed = true
    }
  }
  return { message: textOf(prompt[at]), searched, searchFailed }
}

/** A user message's words. */
const textOf = (message: Prompt[number] | undefined) =>
  message?.role === "user"
    ? message.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("")
    : ""

/** How many searches a message asks for: none without "search". */
const searchesWanted = (message: string) =>
  message.includes("search") ? Number(SEARCHES.exec(message)?.[1] ?? 1) : 0

/** The next search a question asks for, as a step that only calls
 *  webSearch, while the reply still offers the tool. */
function nextSearch(
  { message, searched }: ReturnType<typeof askedOf>,
  tools: Parameters<MockLanguageModelV4["doStream"]>[0]["tools"]
) {
  const offered = (tools ?? []).some((t) => t.name === "webSearch")
  if (!offered || searched >= searchesWanted(message)) return undefined
  return { stream: searchCall(message, searched + 1) }
}

/** What the mock answers once it has searched, if it has. */
const afterSearch = ({ searched, searchFailed }: ReturnType<typeof askedOf>) =>
  searched === 0
    ? undefined
    : searchFailed
      ? SEARCH_FAILED_REPLY
      : SEARCHED_REPLY

/** One step that only calls webSearch. */
const searchCall = (query: string, n: number) =>
  simulateReadableStream<LanguageModelV4StreamPart>({
    initialDelayInMs: 300,
    chunkDelayInMs: 0,
    chunks: [
      {
        type: "tool-call",
        toolCallId: `search-${n}`,
        toolName: "webSearch",
        input: JSON.stringify({ query }),
      },
      {
        type: "finish",
        finishReason: { unified: "tool-calls", raw: undefined },
        usage: {
          inputTokens: {
            total: 0,
            noCache: 0,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 1, text: 0, reasoning: undefined },
        },
      },
    ],
  })

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
    doStream: async ({ prompt, providerOptions, abortSignal, tools }) => {
      const asked = askedOf(prompt)
      const { message } = asked
      const step = failureFor(message, abortSignal) ?? nextSearch(asked, tools)
      if (step !== undefined) return step
      const thinking = thinks(providerOptions?.nvidia?.chat_template_kwargs)
      const bursty = message.includes("burst")
      const words = bursty
        ? BURSTS
        : wordsOf(afterSearch(asked) ?? replyTo(message, modelId, thinking))
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
