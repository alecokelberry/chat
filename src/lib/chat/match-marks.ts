// How Search's message matches mark their words: the server's snippet
// (src/lib/chat/message-index.ts) puts each matched word between
// MATCH_START and MATCH_END, control characters indexed text never holds,
// and the browser (src/components/chat/search-chats.tsx) splits it back
// into pieces with marksOf. Apart from the index, so the browser doesn't
// load the database code.

export const MATCH_START = "\u0001"
export const MATCH_END = "\u0002"

/** A snippet's pieces, in order, the matched ones marked. */
export function marksOf(snippet: string): { text: string; match: boolean }[] {
  return snippet
    .split(MATCH_START)
    .flatMap((piece, index) => {
      if (index === 0) return [{ text: piece, match: false }]
      const [match = "", rest = ""] = piece.split(MATCH_END)
      return [
        { text: match, match: true },
        { text: rest, match: false },
      ]
    })
    .filter((segment) => segment.text !== "")
}
