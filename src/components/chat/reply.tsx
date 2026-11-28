// A reply's markdown, with highlighted code and math, rendered in the
// browser only: thread.tsx loads this module lazily and never on the
// server, so the Worker carries none of it (10 ms of CPU, 3 MB).
//
// Streamdown (by the AI SDK's makers) renders it: it splits a streaming
// reply into blocks and re-parses only the last, and closes what's still
// half-written (an open fence, bold, a formula) so raw syntax never
// flashes. Its code plugin highlights with Shiki, loading each language
// the first time it's used; its math plugin renders with KaTeX.
// prepareMarkdown first rewrites math to the form remark-math reads and
// names each fence's language for its label.
//
// Its own Tailwind classes are switched off: they carry the prefix "sd",
// which this app's Tailwind never generates, so nothing but our prose
// styles (styles/prose.css, on its data-streamdown hooks) reaches the page.
// Its controls (copy, download, link check) are off too: Chat's controls
// are ui-sdk parts, plugged in through its component overrides
// (code-block.tsx, table-actions.tsx).
//
// A streaming reply is paced in the browser (useSmoothText): an even flow
// of whole words, with a breathing caret at the end (stream-caret in
// styles/app.css) until it has all shown. Streamdown's own word fade-in
// isn't used: it lays out each burst at once and fades its words in, so
// lines still jump in bursts and its caret would sit past the shown
// words.
import "katex/dist/katex.min.css"

import { useMemo } from "react"
import { createCodePlugin } from "@streamdown/code"
import { math } from "@streamdown/math"
import { Streamdown } from "streamdown"

import { Code } from "@/components/chat/code-block"
import { Table } from "@/components/chat/table-actions"
import { prepareMarkdown } from "@/lib/chat/markdown"
import { useSmoothText } from "@/lib/chat/smooth-text"
import { whenIdle } from "@/lib/idle"
import { cn } from "@/lib/utils"

const plugins = {
  code: createCodePlugin({
    themes: ["github-light-high-contrast", "github-dark-default"],
  }),
  math,
}
const components = { code: Code, table: Table }

// Shiki (its module, engine and both themes) and TypeScript's highlighter,
// the most common language, start while idle, so a first TypeScript block
// doesn't build them mid-reply. The warm-up tokenizes a short sample, not
// an empty string: Shiki's regex engine compiles each grammar rule the
// first time a line reaches it, and that compiling, not the download, was
// most of the first block's freeze. The sample touches the rules most code
// does (keywords, types, strings, numbers, comments, calls, arrows,
// templates). Another language still builds its own highlighter on first
// use (@streamdown/code keeps one per language), but the shared downloads
// are done.
const WARM_UP = `// Warm-up sample
import { useState } from "react"
export interface User { id: number; name?: string }
export async function load<T extends User>(id: number): Promise<T | null> {
  const res = await fetch(\`/api/\${id}\`, { method: "GET" })
  if (!res.ok) return null
  const items: string[] = [1, 2.5, 0xff].map((n) => String(n))
  return (await res.json()) as T
}
class Box { private v = 0; get value() { return this.v } }
`
whenIdle(() =>
  plugins.code.highlight({
    code: WARM_UP,
    language: "typescript",
    themes: plugins.code.getThemes(),
  })
)
const linkSafety = { enabled: false }

export default function Reply({
  text,
  streaming,
  stopped,
}: {
  text: string
  /** Still arriving: paced, and half-written markdown is closed or held
   *  back. */
  streaming: boolean
  /** Cut off by Stop: what arrived shows at once. */
  stopped: boolean
}) {
  const shown = useSmoothText(text, { streaming, stopped })
  // Stopped: settled at once, though the stream takes a moment to close.
  const live = !stopped && (streaming || !shown.done)
  const markdown = useMemo(
    () => prepareMarkdown(shown.text, live),
    [shown.text, live]
  )
  return (
    <div className={cn("typeset typeset-docs", live && "stream-caret")}>
      <Streamdown
        prefix="sd"
        plugins={plugins}
        components={components}
        isAnimating={live}
        controls={false}
        linkSafety={linkSafety}
        lineNumbers={false}
        codeBlockMaxHeight={0}
        tableMaxHeight={0}
      >
        {markdown}
      </Streamdown>
    </div>
  )
}
