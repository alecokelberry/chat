// Which web addresses the model may use: the search results' links, which
// the chat shows, and the pages readPage opens (src/lib/ai/read-page.ts).
// Pure, so tests check it directly. Only http(s): any other scheme in a
// link could run script. readPage also refuses an address that names a
// private or local machine (localhost, a LAN or link-local IP, an IPv6
// literal, a .local or .internal name) or carries a password, so a page or
// a prompt can't point it at something that isn't the public web.
// Keenable, which does the fetching, refuses private addresses too; this
// check says why before anything leaves.
//
// And readPage opens only an address in the reply's KnownAddresses: one
// written out whole (writtenIn) in the owner's questions or documents in
// the chat, in this reply's search results, or in a page this reply read.
// An address the model wrote itself is refused, and a link a page gives
// opens only on that page's own site.

/** An address's site (its host, without "www."), or null if it isn't an
 *  http(s) address. */
export function siteOf(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== "https:" && protocol !== "http:") return null
    return hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

const LOCAL_NAMES = /(^|\.)(localhost|local|internal|home\.arpa|lan)$/i

/** IPv4 ranges that aren't the public internet, as [first octet, second
 *  octet from, second octet to]. */
const PRIVATE_V4: [number, number, number][] = [
  [0, 0, 255],
  [10, 0, 255],
  [100, 64, 127],
  [127, 0, 255],
  [169, 254, 254],
  [172, 16, 31],
  [192, 168, 168],
]

function isPrivateV4(hostname: string) {
  const octets = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname)
  if (octets === null) return false
  const [a, b] = [Number(octets[1]), Number(octets[2])]
  return (
    a >= 224 ||
    PRIVATE_V4.some(([x, from, to]) => a === x && b >= from && b <= to)
  )
}

/** Why readPage won't open an address, or null if it may. */
export function refusalFor(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "That isn't a web address."
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    return "Only http and https pages can be read."
  if (url.length > 2048) return "That address is too long."
  if (parsed.username !== "" || parsed.password !== "")
    return "Addresses with a login in them can't be read."
  if (isPrivateHost(parsed.hostname))
    return "That address is on a private or local network, so it can't be read."
  return null
}

/** A host that names a machine off the public web: an IPv6 literal, a
 *  name with no dot, a local name or a private IPv4 address. */
const isPrivateHost = (host: string) =>
  host.startsWith("[") ||
  !host.includes(".") ||
  LOCAL_NAMES.test(host) ||
  isPrivateV4(host)

/** Why readPage won't open an address the reply hasn't seen. */
export const UNSEEN_ADDRESS =
  "That address isn't in the chat, the search results or a page read for this reply, so it can't be read."

/** The characters an address can hold (RFC 3986's, plus %). */
const ADDRESS_CHAR = /[\w\-.~:/?#[\]@!$&'()*+,;=%]/

/** What may follow an address that ends a sentence or sits in brackets
 *  or quotes: only these, before a space or the end. */
const CLOSING = /^[.,;:!?'")\]]*$/

/** Whether `url` is written out whole in `text`: there, and not running
 *  on into more of an address, so it can't be the start of a longer one
 *  with something added. Closing punctuation after it is fine ("see
 *  https://example.org/a.", "[a](https://example.org/a)"). */
export function appearsIn(url: string, text: string): boolean {
  if (url === "") return false
  for (let at = text.indexOf(url); at !== -1; at = text.indexOf(url, at + 1)) {
    let end = at + url.length
    while (end < text.length && ADDRESS_CHAR.test(text.charAt(end))) end += 1
    if (CLOSING.test(text.slice(at + url.length, end))) return true
  }
  return false
}

/** Whether `url` is written in `text` (appearsIn), or, as https, is a
 *  bare address written there without its scheme ("example.org/a"), as
 *  people often type one. */
export function writtenIn(url: string, text: string): boolean {
  if (appearsIn(url, text)) return true
  const bare = url.startsWith("https://") ? url.slice("https://".length) : ""
  return bare.includes(".") && appearsIn(bare, text)
}

/** The text one reply's addresses may come from: the owner's words at
 *  first, then each search's results and each page read, added as they
 *  arrive. Each text is checked on its own, so no address is pieced
 *  together from two. A page's text is added with its site: a link in it
 *  counts only on that same site. */
export function knownAddresses(ownWords: string[]) {
  const texts: { text: string; site?: string }[] = ownWords.map((text) => ({
    text,
  }))
  return {
    add: (text: string, site?: string) => {
      texts.push({ text, site })
    },
    has: (url: string) =>
      texts.some(
        ({ text, site }) =>
          writtenIn(url, text) && (site === undefined || siteOf(url) === site)
      ),
  }
}

export type KnownAddresses = ReturnType<typeof knownAddresses>
