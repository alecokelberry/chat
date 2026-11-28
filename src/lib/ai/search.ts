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
// reason says so. Keenable's own status goes to the log, never the key.
// Stop cancels a search in flight (the reply's abort signal). The tool is
// built for each reply and counts its calls: past SEARCH_LIMIT, even calls
// made at once in one step, it tells the model no without asking Keenable.
// Each result joins the reply's KnownAddresses (src/lib/ai/web-address.ts).
// With MOCK_MODEL "1" the mock's canned results answer instead
// (src/lib/ai/mock.ts), so tests never go out.
import { env } from "cloudflare:workers"
import { tool } from "ai"
import { z } from "zod"

import { guarded, keenable } from "@/lib/ai/keenable"
import { mockSearch } from "@/lib/ai/mock"
import { siteOf, type KnownAddresses } from "@/lib/ai/web-address"

/** At most this many searches in one reply. */
export const SEARCH_LIMIT = 3

const RESULTS = 5
const SNIPPET_CHARS = 600
const TIMEOUT_MS = 10_000

type SearchResult = {
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

async function search(query: string, abortSignal: AbortSignal | undefined) {
  const json = await keenable(
    "search",
    {
      query,
      max_results: RESULTS,
      snippet_max_length: SNIPPET_CHARS,
      disable_cards: true,
    },
    TIMEOUT_MS,
    abortSignal
  )
  return toResults(KeenableResults.parse(json).results)
}

/** The webSearch tool for one reply: past SEARCH_LIMIT calls, even ones
 *  made at once in a single step, it refuses without asking Keenable. A
 *  refusal is for the model only: the chat leaves it out
 *  (src/lib/chat/searches.ts). Its results join `known`. */
export const webSearch = (known: KnownAddresses) => {
  let left = SEARCH_LIMIT
  return tool({
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
      if (left <= 0)
        return {
          refused: `That's the ${SEARCH_LIMIT} searches this reply can make. Answer from what you have.`,
        }
      left -= 1
      return guarded(
        "Search",
        {
          used: "This month's free web searches are used up.",
          failed: "The web search failed, so nothing was found.",
        },
        abortSignal,
        async () => {
          const results: SearchResult[] =
            env.MOCK_MODEL === "1"
              ? await mockSearch(query, abortSignal)
              : await search(query, abortSignal)
          for (const { url, site, title, snippet } of results) {
            known.add(url)
            known.add(`${title}\n${snippet}`, site)
          }
          return { results }
        }
      )
    },
  })
}
