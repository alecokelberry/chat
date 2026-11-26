// What a reply's metadata records (src/lib/chat/agent.ts): the model that
// answered, when the send reached the server, and how long the reply took
// from there to its last word or to Stop. Read back field by field: a
// chat's messages are data.
import { MODELS, type ModelKey } from "@/lib/ai/models"

export type ReplyMetadata = { model?: ModelKey; started?: number; ms?: number }

const field = (metadata: unknown, key: string): unknown =>
  typeof metadata === "object" && metadata !== null && key in metadata
    ? Reflect.get(metadata, key)
    : undefined

/** When the reply's send reached the server, if it says. */
export function startedAt(metadata: unknown): number | undefined {
  const started = field(metadata, "started")
  return typeof started === "number" ? started : undefined
}

/** "Super · 4.2s", "Ultra · 12s", or undefined until the model is known. */
export function answeredBy(metadata: unknown): string | undefined {
  const name = MODELS.find((m) => m.key === field(metadata, "model"))?.name
  if (name === undefined) return undefined
  const ms = field(metadata, "ms")
  if (typeof ms !== "number" || !(ms > 0)) return name
  const tenths = Math.round(ms / 100) / 10
  const seconds = tenths < 10 ? tenths.toFixed(1) : Math.round(tenths)
  return `${name} · ${seconds}s`
}
