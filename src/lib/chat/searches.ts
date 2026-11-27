// What a reply's web searches show (thread.tsx, sources.tsx), read from its
// webSearch tool parts (src/lib/ai/search.ts), which the agent saves with
// the reply like any part. A chat's messages are data, so each field is
// checked, and a result's address is kept only if it's http(s): it
// becomes a link.
import { field } from "@/lib/field"

export type Source = { title: string; url: string; site: string }

export type Search = {
  query: string
  /** Still waiting for its results. */
  running: boolean
  /** Its results came back (perhaps none). */
  found: boolean
  /** Why it failed, if it did. */
  error: string | undefined
  results: Source[]
}

const text = (value: unknown) => (typeof value === "string" ? value : "")

const isWebLink = (url: string) => {
  try {
    const { protocol } = new URL(url)
    return protocol === "https:" || protocol === "http:"
  } catch {
    return false
  }
}

function resultsOf(output: unknown): Source[] {
  const results = field(output, "results")
  if (!Array.isArray(results)) return []
  return results.flatMap((result: unknown) => {
    const url = text(field(result, "url"))
    const site = text(field(result, "site"))
    if (!isWebLink(url) || site === "") return []
    return [{ title: text(field(result, "title")) || site, url, site }]
  })
}

/** A reply's searches, in the order it made them. */
export function searchesOf(message: { parts: readonly unknown[] }): Search[] {
  return message.parts.flatMap((part) => {
    if (field(part, "type") !== "tool-webSearch") return []
    // Past the cap, the model was told no: nothing was searched.
    if (field(field(part, "output"), "refused") !== undefined) return []
    const state = field(part, "state")
    return [
      {
        query: text(field(field(part, "input"), "query")),
        running: state === "input-streaming" || state === "input-available",
        found: state === "output-available",
        error:
          state === "output-error"
            ? text(field(part, "errorText")).slice(0, 200) ||
              "The search failed."
            : undefined,
        results: resultsOf(field(part, "output")),
      },
    ]
  })
}

/** Each site the searches found once, at its first result's address. */
export function sourcesOf(searches: Search[]): Source[] {
  const bySite = new Map<string, Source>()
  for (const result of searches.flatMap((search) => search.results))
    if (!bySite.has(result.site)) bySite.set(result.site, result)
  return [...bySite.values()]
}

/** The search step's label: "Searching the web…" while one runs, then
 *  how many sites it found, or why it found none. */
export function searchedLabel(searches: Search[], running: boolean) {
  if (running) return "Searching the web…"
  const sites = sourcesOf(searches).length
  if (sites > 0) return `Searched · ${sites} ${sites === 1 ? "site" : "sites"}`
  if (searches.some((search) => search.error !== undefined))
    return "Couldn't search the web"
  return searches.some((search) => search.found)
    ? "Searched · nothing found"
    : "Search stopped"
}
