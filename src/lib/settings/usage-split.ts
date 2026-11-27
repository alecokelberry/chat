// Settings › Usage's numbers: each model's share of all the tokens used,
// from the per-model totals D1 sums (src/lib/chat/usage.ts). Models come
// in the picker's order (src/lib/ai/models.ts), so a model keeps its
// place and color however the shares change; a model no longer offered is
// folded into Other, last. A model with no tokens draws nothing. Each
// share is its own whole percent, rounded, so models that used the same
// show the same; the shares may add up to 99 or 101, and one under half a
// percent is 0 (the page shows it as under 1%).
import { MODELS } from "@/lib/ai/models"

type UsagePart = {
  /** The model's key, or "other". */
  key: string
  name: string
  /** Its color, 1 to 5: its place in the picker's order, Other last. */
  slot: number
  tokens: number
  replies: number
  /** Its share of the tokens, rounded to a whole percent. */
  percent: number
}

export type UsageSplit = { tokens: number; replies: number; parts: UsagePart[] }

export function splitUsage(
  rows: readonly { model: string; replies: number; tokens: number }[]
): UsageSplit {
  const named = [
    ...MODELS.map((model) => ({ key: model.key, name: model.name })),
    { key: "other", name: "Other" },
  ]
  const known = new Set<string>(MODELS.map((model) => model.key))
  const totals = named.map(({ key, name }, index) => {
    const mine = rows.filter((row) =>
      key === "other" ? !known.has(row.model) : row.model === key
    )
    return {
      key,
      name,
      slot: index + 1,
      tokens: mine.reduce((total, row) => total + row.tokens, 0),
      replies: mine.reduce((total, row) => total + row.replies, 0),
    }
  })
  const tokens = totals.reduce((total, part) => total + part.tokens, 0)
  const replies = totals.reduce((total, part) => total + part.replies, 0)
  if (tokens === 0) return { tokens, replies, parts: [] }
  const used = totals.filter((part) => part.tokens > 0)
  return {
    tokens,
    replies,
    parts: used.map((part) => ({
      ...part,
      percent: Math.round((part.tokens / tokens) * 100),
    })),
  }
}
