// A reply's markdown, readied for the renderer (components/chat/reply.tsx).
// Two rewrites, both outside code:
//
// - Math. Models write inline `$…$` and `\(…\)`, display `$$…$$` and
//   `\[…\]`. remark-math, with single dollars off, reads only `$$`: inline
//   `$$…$$`, and display as a `$$` line above and below. A single `$` counts
//   as math only by Pandoc's rule (a non-space after the opening `$`, a
//   non-space before the closing one, and no digit right after it), so
//   "$5 and $10" stays text.
// - A code fence's language, named as people write it ("```ts" becomes
//   "```TypeScript", Shiki's own name for it), since the renderer shows it
//   as the block's label. The highlighter reads names case-blind.
//
// While a reply streams, the half-written pieces raw text would show are
// held back until they finish (holdPartial). Pure and line by line, so it
// runs on every streamed word.

import { bundledLanguagesInfo } from "shiki"

const FENCE_OPEN = /^(\s{0,3})(`{3,}|~{3,})(.*)$/

/** Each language Shiki highlights, by its id and aliases, to its display
 *  name ("ts" → "TypeScript"). Only names the highlighter reads back (the
 *  name, lowercased, is the id or an alias) are used; for the rest the fence
 *  keeps what the model wrote, so highlighting never breaks. */
const LANGUAGES = new Map(
  bundledLanguagesInfo.flatMap(({ id, name, aliases = [] }) =>
    [id, ...aliases].includes(name.toLowerCase())
      ? [id, ...aliases].map((key) => [key, name] as const)
      : []
  )
)

type Close = "$$" | "\\]"
type Display = { close: Close; indent: string }
/** Where a line leaves us: inside a code fence, a display formula, or
 *  neither. */
type State = { fence?: string; display?: Display }

/** The reply's markdown for the renderer. While it streams, the trailing
 *  pieces that would flash as raw text until they finish are held back. */
export function prepareMarkdown(text: string, streaming = false): string {
  const out: string[] = []
  let state: State = {}
  for (const line of (streaming ? holdPartial(text) : text).split("\n")) {
    const next = nextState(state, line)
    out.push(...rewriteLine(line, state, next))
    state = next
  }
  return out.join("\n")
}

// "```lang" being typed, or just its first one or two marks.
const FENCE_LINE = /^\s{0,3}(?:(?:`{3,}|~{3,})[^`\n]*|`{1,2}|~{1,2})$/
const TABLE_ROW = /^\s{0,3}\|/
const TABLE_DELIMITER = /^\s{0,3}\|?(?:\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/

/** Hold back, from the end of a streaming reply: a fence line still being
 *  typed (its label would flicker through partial names), a display
 *  formula that hasn't closed, an inline one still open on the last line
 *  (half of one is LaTeX source or a KaTeX error), and table rows whose
 *  delimiter row hasn't arrived (they'd show as raw pipes). */
function holdPartial(text: string): string {
  const lines = text.split("\n")
  const last = lines.at(-1) ?? ""
  if (FENCE_LINE.test(last)) return cut(text, text.length - last.length)
  let state: State = {}
  let offset = 0
  let opened = 0
  for (const line of lines) {
    const next = nextState(state, line)
    if (state.display === undefined && next.display !== undefined) {
      opened = offset
    }
    state = next
    offset += line.length + 1
  }
  if (state.display !== undefined) return cut(text, opened)
  if (state.fence !== undefined) return text
  const open = openInline(last)
  if (open !== undefined) return cut(text, text.length - last.length + open)
  return holdTableRows(text, lines)
}

function cut(text: string, end: number) {
  return text.slice(0, end).trimEnd()
}

function holdTableRows(text: string, lines: string[]): string {
  // The rows end the reply, perhaps before a newline that just arrived.
  const end =
    (lines.at(-1) ?? "").trim() === "" ? lines.length - 1 : lines.length
  let start = end
  while (start > 0 && TABLE_ROW.test(lines[start - 1] ?? "")) start--
  if (start === end || isTable(lines.slice(start))) return text
  return lines.slice(0, start).join("\n").trimEnd()
}

function isTable([header = "", delimiter = ""]: string[]) {
  return (
    TABLE_DELIMITER.test(delimiter) &&
    cellCount(delimiter) === cellCount(header)
  )
}

function cellCount(row: string) {
  return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").length
}

function nextState(state: State, line: string): State {
  const mark = FENCE_OPEN.exec(line)?.[2]
  if (state.fence !== undefined) {
    return closesFence(line, mark, state.fence) ? {} : state
  }
  if (state.display !== undefined) {
    return line.trimEnd().endsWith(state.display.close) ? {} : state
  }
  if (mark !== undefined) return { fence: mark }
  const close = opensDisplay(line.trim())
  if (close === undefined) return {}
  return { display: { close, indent: /^\s*/.exec(line)?.[0] ?? "" } }
}

/** How a display formula that opens on this line closes, if it doesn't
 *  close on the same line. */
function opensDisplay(trimmed: string): Close | undefined {
  if (trimmed.startsWith("$$"))
    return trimmed.slice(2).includes("$$") ? undefined : "$$"
  if (trimmed.startsWith("\\["))
    return trimmed.includes("\\]") ? undefined : "\\]"
  return undefined
}

/** A closing fence: the opening's mark, at least as long, alone on its line. */
function closesFence(line: string, mark: string | undefined, fence: string) {
  return (
    mark !== undefined &&
    mark[0] === fence[0] &&
    mark.length >= fence.length &&
    line.trim() === mark
  )
}

function rewriteLine(line: string, before: State, after: State): string[] {
  if (before.fence !== undefined) return [line]
  if (after.fence !== undefined) return [nameLanguage(line)]
  if (before.display === undefined) return proseLine(line, after.display)
  if (after.display !== undefined) return [line]
  // The closing line: what's before the mark, then `$$`.
  const body = line.trimEnd().slice(0, -2)
  const close = `${before.display.indent}$$`
  return body.trim() ? [body, close] : [close]
}

function proseLine(line: string, opens: Display | undefined): string[] {
  const indent = /^\s*/.exec(line)?.[0] ?? ""
  const trimmed = line.trim()
  if (opens !== undefined) {
    const rest = trimmed.slice(2).trim()
    return rest ? [`${indent}$$`, `${indent}${rest}`] : [`${indent}$$`]
  }
  if (isWholeFormula(trimmed)) {
    // A whole formula on its own line is display math.
    return [
      `${indent}$$`,
      `${indent}${trimmed.slice(2, -2).trim()}`,
      `${indent}$$`,
    ]
  }
  return [inlineMath(line)]
}

/** An opening fence line with its language named for people. */
function nameLanguage(line: string) {
  const [, indent = "", mark = "", info = ""] = FENCE_OPEN.exec(line) ?? []
  const [language = "", ...meta] = info.trim().split(/\s+/)
  const name = LANGUAGES.get(language.toLowerCase())
  if (name === undefined) return line
  return `${indent}${mark}${[name, ...meta].join(" ")}`
}

/** `$$…$$` or `\[…\]` and nothing else. */
function isWholeFormula(trimmed: string) {
  const body = trimmed.slice(2, -2)
  if (body.trim() === "") return false
  if (trimmed.startsWith("$$"))
    return trimmed.endsWith("$$") && !body.includes("$$")
  return (
    trimmed.startsWith("\\[") &&
    trimmed.endsWith("\\]") &&
    !body.includes("\\]")
  )
}

/** One line's inline math as `$$…$$`, code spans left alone. */
function inlineMath(line: string): string {
  let text = ""
  for (let i = 0; i < line.length;) {
    const step = inlineStep(line, i)
    text += step.text
    i = step.next
  }
  return text
}

/** Where the line's first formula that hasn't closed starts, if any. */
function openInline(line: string): number | undefined {
  for (let i = 0; i < line.length;) {
    const step = inlineStep(line, i)
    if (step.open === true) return i
    i = step.next
  }
  return undefined
}

type Step = { text: string; next: number; open?: boolean }

/** What starts at `i`: a code span, an escaped `$`, a formula, or a char. */
function inlineStep(line: string, i: number): Step {
  const ticks = /^`+/.exec(line.slice(i))?.[0]
  if (ticks !== undefined) {
    // A code span runs to the next run of as many backticks; one still
    // streaming in, to the end of the line.
    const end = findTicks(line, i + ticks.length, ticks.length)
    const next = end === -1 ? line.length : end + ticks.length
    return { text: line.slice(i, next), next }
  }
  if (line.startsWith("\\$", i)) return { text: "\\$", next: i + 2 }
  const span = delimitedSpan(line, i) ?? dollarSpan(line, i)
  if (span === "open") return { text: line[i] ?? "", next: i + 1, open: true }
  if (span !== undefined) return { text: `$$${span.body}$$`, next: span.end }
  return { text: line[i] ?? "", next: i + 1 }
}

type Span = { body: string; end: number } | "open" | undefined

const DELIMITERS = [
  ["\\(", "\\)"],
  ["\\[", "\\]"],
  ["$$", "$$"],
] as const

/** `\(…\)`, `\[…\]` or `$$…$$` starting at `i`, or "open" when it doesn't
 *  close on this line. */
function delimitedSpan(line: string, i: number): Span {
  const pair = DELIMITERS.find(([start]) => line.startsWith(start, i))
  if (pair === undefined) return undefined
  const close = line.indexOf(pair[1], i + 2)
  if (close === -1) return "open"
  const body = line.slice(i + 2, close).trim()
  return body ? { body, end: close + 2 } : undefined
}

/** `$…$` by Pandoc's rule, closed by the next `$`. Unclosed, "$5" is a
 *  price, and "$x" or "$\pi" a formula on its way. */
function dollarSpan(line: string, i: number): Span {
  const first = line[i + 1] ?? ""
  if (line[i] !== "$" || !/\S/.test(first)) return undefined
  const j = nextDollar(line, i + 2)
  if (j === -1) return /\d/.test(first) ? undefined : "open"
  const closes = /\S/.test(line[j - 1] ?? "") && !/\d/.test(line[j + 1] ?? "")
  return closes ? { body: line.slice(i + 1, j), end: j + 1 } : undefined
}

/** The next `$` from `from` that isn't escaped, or -1. */
function nextDollar(line: string, from: number) {
  let j = line.indexOf("$", from)
  while (j !== -1 && line[j - 1] === "\\") j = line.indexOf("$", j + 1)
  return j
}

function findTicks(line: string, from: number, count: number) {
  for (let j = from; j < line.length; j++) {
    if (line[j] !== "`") continue
    let n = 0
    while (line[j + n] === "`") n++
    if (n === count) return j
    j += n - 1
  }
  return -1
}
