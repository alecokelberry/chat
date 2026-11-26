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
// are ui-sdk parts.
import "katex/dist/katex.min.css"

import { useMemo } from "react"
import { createCodePlugin } from "@streamdown/code"
import { math } from "@streamdown/math"
import { Streamdown } from "streamdown"

import { prepareMarkdown } from "@/lib/chat/markdown"

const plugins = {
  code: createCodePlugin({
    themes: ["github-light-high-contrast", "github-dark-default"],
  }),
  math,
}
const linkSafety = { enabled: false }

export default function Reply({
  text,
  streaming,
}: {
  text: string
  /** Still arriving: half-written markdown is closed or held back. */
  streaming: boolean
}) {
  const markdown = useMemo(
    () => prepareMarkdown(text, streaming),
    [text, streaming]
  )
  return (
    <div className="typeset typeset-docs">
      <Streamdown
        prefix="sd"
        plugins={plugins}
        isAnimating={streaming}
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
