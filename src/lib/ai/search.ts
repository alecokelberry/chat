// Web search, as a tool the model calls when a question needs current facts
// (src/lib/ai/index.ts offers it to every model). It asks Keenable's search
// API (docs.keenable.ai: 100,000 free searches a month, no card), keyed by
// the KEENABLE_API_KEY secret, for five results and keeps each one's title,
// address, site and a short snippet, so the chat's history stays small.
// It runs in the chat's Durable Object, beside the model call, so its wait
// and its JSON cost the Worker's 10 ms nothing.
//
// A search that fails (Keenable down, a bad key, or 10 s with no answer)
// throws a short reason the model reads as the tool's error, so it says it
// couldn't search and answers anyway; the step shows the same reason.
// Keenable's 402 means the month's free searches are used up, and the
// reason says so. Keenable's own status goes to the log, never the key. Stop cancels a search in flight
// (the reply's abort signal). With MOCK_MODEL "1" the mock's canned
// results answer instead (src/lib/ai/mock.ts), so tests never go out.
import { env } from "cloudflare:workers"
import { tool } from "ai"
import { z } from "zod"

import { mockSearch } from "@/lib/ai/mock"

/** At most this many searches in one reply. */
export const SEARCH_LIMIT = 3

const RESULTS = 5
const SNIPPET_CHARS = 600
const TIMEOUT_MS = 10_000

export type SearchResult = {
  title: string
  url: string
  /** The address's host, without "www.". */
  site: string
  snippet: string
}

const KeenableResults = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string().optional(),
    })
  ),
})

/** A result's site, or null for an address that isn't http(s): a link
 *  the page shows must never run script. */
function siteOf(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== "https:" && protocol !== "http:") return null
    return hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

/** Keenable's results, trimmed to what the model and the page need. */
function toResults(
  results: z.infer<typeof KeenableResults>["results"]
): SearchResult[] {
  return results.flatMap(({ title, url, snippet }) => {
    const site = siteOf(url)
    if (site === null) return []
    return [
      {
        title: title.slice(0, 200),
        url,
        site,
        snippet: (snippet ?? "").slice(0, SNIPPET_CHARS),
      },
    ]
  })
}

async function keenable(query: string, abortSignal: AbortSignal | undefined) {
  const signals = [AbortSignal.timeout(TIMEOUT_MS)]
  if (abortSignal !== undefined) signals.push(abortSignal)
  const response = await fetch("https://api.keenable.ai/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.KEENABLE_API_KEY,
    },
    body: JSON.stringify({
      query,
      max_results: RESULTS,
      snippet_max_length: SNIPPET_CHARS,
      disable_cards: true,
    }),
    signal: AbortSignal.any(signals),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new KeenableError(response.status)
  }
  return toResults(KeenableResults.parse(await response.json()).results)
}

class KeenableError extends Error {
  constructor(readonly status: number) {
    super(`Keenable answered ${status}`)
  }
}

/** A search that failed, as the model and the chat read it. */
export class SearchFailedError extends Error {
  constructor(cause: unknown) {
    super(
      cause instanceof KeenableError && cause.status === 402
        ? "This month's free web searches are used up."
        : "The web search failed, so nothing was found."
    )
  }
}

export const webSearch = tool({
  description:
    "Search the web. Use it when the question needs current or changing facts (news, prices, releases, schedules, scores, anything after your training) or when asked to search or look something up. Returns the top results with a snippet each.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(400)
      .describe("What to search for, in plain words, as a person would"),
  }),
  execute: async ({ query }, { abortSignal }) => {
    try {
      const results =
        env.MOCK_MODEL === "1"
          ? await mockSearch(query, abortSignal)
          : await keenable(query, abortSignal)
      return { results }
    } catch (error) {
      if (abortSignal?.aborted === true) throw error
      console.error(
        "Search failed:",
        error instanceof Error ? error.message : String(error)
      )
      throw new SearchFailedError(error)
    }
  },
})
