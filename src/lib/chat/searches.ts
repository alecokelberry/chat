// What a reply's web searches and page reads show (thread.tsx,
// sources.tsx), read from its webSearch and readPage tool parts
// (src/lib/ai/search.ts, read-page.ts), which the agent saves with the
// reply like any part. A page read counts as a search that found that one
// page, so it joins the step and the sources the same way. A chat's messages are data, so each field is
// checked, and a result's address is kept only if it's http(s): it
// becomes a link.
import { field } from "@/lib/field"

export type Source = { title: string; url: string; site: string }

export type Search = {
  /** A web search, or one page read. */
  kind: "search" | "read"
  /** What was searched for, or the address read. */
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

function resultsOf(kind: Search["kind"], output: unknown): Source[] {
  const results = kind === "read" ? [output] : field(output, "results")
  if (!Array.isArray(results)) return []
  return results.flatMap((result: unknown) => {
    const url = text(field(result, "url"))
    const site = text(field(result, "site"))
    if (!isWebLink(url) || site === "") return []
    return [{ title: text(field(result, "title")) || site, url, site }]
  })
}

const KINDS: Record<string, Search["kind"]> = {
  "tool-webSearch": "search",
  "tool-readPage": "read",
}

/** A reply's searches and reads, in the order it made them. */
export function searchesOf(message: { parts: readonly unknown[] }): Search[] {
  return message.parts.flatMap((part) => {
    const kind = KINDS[text(field(part, "type"))]
    if (kind === undefined) return []
    // Past the cap, the model was told no: nothing was searched or read.
    if (field(field(part, "output"), "refused") !== undefined) return []
    const state = field(part, "state")
    const input = field(part, "input")
    return [
      {
        kind,
        query: text(field(input, kind === "read" ? "url" : "query")),
        running: state === "input-streaming" || state === "input-available",
        found: state === "output-available",
        error:
          state === "output-error"
            ? text(field(part, "errorText")).slice(0, 200) ||
              "The search failed."
            : undefined,
        results: resultsOf(kind, field(part, "output")),
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

/** The step's label: what runs while one does, then how many sites it
 *  found, or why it found none. A reply that only read pages says so. */
export function searchedLabel(searches: Search[], running: boolean) {
  const reading = searches.every((search) => search.kind === "read")
  if (running)
    return searches.some((s) => s.running && s.kind === "read")
      ? "Reading the page…"
      : "Searching the web…"
  const sites = sourcesOf(searches).length
  if (sites > 0) {
    const counted = `${sites} ${sites === 1 ? "site" : "sites"}`
    return reading ? `Read · ${counted}` : `Searched · ${counted}`
  }
  if (searches.some((search) => search.error !== undefined))
    return reading ? "Couldn't read the page" : "Couldn't search the web"
  if (searches.some((search) => search.found)) return "Searched · nothing found"
  return reading ? "Reading stopped" : "Search stopped"
}
