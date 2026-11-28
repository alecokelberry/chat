// A reply's math renderer and its CSS, in a chunk of their own: KaTeX is
// 75 KB gzipped, which every saved chat would download whether or not a
// reply has math. reply.tsx imports this the first time a reply does.
import "katex/dist/katex.min.css"

export { math } from "@streamdown/math"
