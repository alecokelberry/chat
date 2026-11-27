// The starters: three questions offered under a new chat's composer. One
// tap puts its words in the composer (nothing is sent), so they can be
// changed first. Fixed, not random, so the page renders the same for the
// server and the browser. The first suits web search: it needs today's
// news.
import { CodeIcon, GlobeIcon, LightbulbIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const STARTERS: { icon: LucideIcon; text: string }[] = [
  { icon: GlobeIcon, text: "What's in the news today?" },
  { icon: LightbulbIcon, text: "Explain how compound interest works" },
  { icon: CodeIcon, text: "Write a script that renames files in bulk" },
]
