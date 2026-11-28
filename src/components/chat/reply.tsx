// A reply's markdown, with highlighted code and math, rendered in the
// browser only: thread.tsx loads this module lazily and never on the
// server, so the Worker carries none of it (10 ms of CPU, 3 MB).
//
// Streamdown (by the AI SDK's makers) renders it: it splits a streaming
// reply into blocks and re-parses only the last, and closes what's still
// half-written (an open fence, bold, a formula) so raw syntax never
// flashes. Its code plugin highlights with Shiki, loading each language
// the first time it's used; its math plugin renders with KaTeX, and loads
// (with its CSS, reply-math.ts) the first time a reply has math: a saved
// chat without any doesn't download it. A reply that's still arriving
// shows what comes before its first formula until the plugin is there,
// and a finished one waits for it, so raw TeX never shows.
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
import { use, useEffect, useMemo, useState } from "react"
import { createCodePlugin } from "@streamdown/code"
import { Streamdown } from "streamdown"

import { Code } from "@/components/chat/code-block"
import { Table } from "@/components/chat/table-actions"
import { prepareMarkdown } from "@/lib/chat/markdown"
import { useSmoothText } from "@/lib/chat/smooth-text"
import { whenIdle } from "@/lib/idle"
import { cn } from "@/lib/utils"

const code = createCodePlugin({
  themes: ["github-light-high-contrast", "github-dark-default"],
})
const plugins = { code }
const components = { code: Code, table: Table }

// Shiki (its module, engine and both themes) and TypeScript's highlighter,
// the most common language, start while idle, so a first TypeScript block
// doesn't build them mid-reply. Another language still builds its own
// highlighter on first use (@streamdown/code keeps one per language), but
// the shared downloads are done. In the iOS Simulator, with the cache off,
// it took the first markdown reply's worst frame from 44 ms to 32 ms.
whenIdle(() =>
  code.highlight({
    code: "",
    language: "typescript",
    themes: code.getThemes(),
  })
)
const linkSafety = { enabled: false }

type Plugins = {
  code: typeof code
  math?: (typeof import("@streamdown/math"))["math"]
}
let withMath: Plugins | undefined
let loading: Promise<Plugins> | undefined

/** The plugins with math, loading it once. */
function loadMath() {
  loading ??= import("@/components/chat/reply-math").then(
    ({ math }) => (withMath = { code, math }),
    (error: unknown) => {
      // Offline, or a chunk a deploy replaced: the next render tries again.
      loading = undefined
      throw error
    }
  )
  return loading
}

/** prepareMarkdown writes all math as `$$`. */
const hasMath = (markdown: string) => markdown.includes("$$")

/** The plugins for `markdown`, and what of it can show now: with math the
 *  plugin isn't loaded for yet, a streaming reply stops before its first
 *  formula and a finished one waits (Suspense, in thread.tsx). */
function usePlugins(markdown: string, live: boolean) {
  const needed = hasMath(markdown)
  const [, loaded] = useState(0)
  useEffect(() => {
    if (needed && withMath === undefined)
      loadMath().then(
        () => loaded((n) => n + 1),
        () => undefined
      )
  }, [needed])
  if (!needed) return { plugins, markdown }
  if (withMath !== undefined) return { plugins: withMath, markdown }
  if (!live) return { plugins: use(loadMath()), markdown }
  return {
    plugins,
    markdown: markdown.slice(0, markdown.indexOf("$$")).trimEnd(),
  }
}

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
  const prepared = useMemo(
    () => prepareMarkdown(shown.text, live),
    [shown.text, live]
  )
  const { plugins, markdown } = usePlugins(prepared, live)
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
