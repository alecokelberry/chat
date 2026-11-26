// What a reply's metadata records (src/lib/chat/agent.ts): the model that
// answered, when the send reached the server, how long the reply took from
// there to its last word or to Stop, and, if the model thought, when it
// started and for how long (from its first thought to the end of its last,
// or to Stop; with several steps, the time between them counts). Read back
// field by field: a chat's messages are data.
import { MODELS, type ModelKey } from "@/lib/ai/models"

export type ReplyMetadata = {
  model?: ModelKey
  /** When the send reached the server (epoch ms). */
  started?: number
  /** How long the reply took, in ms. */
  ms?: number
  /** When the model started thinking (epoch ms). */
  thinking?: number
  /** How long it thought, in ms. */
  thought?: number
}

const field = (metadata: unknown, key: string): unknown =>
  typeof metadata === "object" && metadata !== null && key in metadata
    ? Reflect.get(metadata, key)
    : undefined

const numberAt = (metadata: unknown, key: string) => {
  const value = field(metadata, key)
  return typeof value === "number" ? value : undefined
}

/** A stopped or failed reply's metadata, which never got its finish: its
 *  time to `now`, and its thought to `now` if it was still thinking. */
export function stoppedMetadata(metadata: unknown, now: number) {
  const saved = typeof metadata === "object" ? metadata : undefined
  const thinking = numberAt(metadata, "thinking")
  const stillThinking =
    thinking !== undefined && numberAt(metadata, "thought") === undefined
  return {
    ...saved,
    ms: now - (numberAt(metadata, "started") ?? now),
    ...(stillThinking && { thought: now - thinking }),
  }
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

/** "Thought for 12s" (at least 1s), or "Thoughts" when the time wasn't
 *  saved. */
export function thoughtFor(metadata: unknown): string {
  const ms = numberAt(metadata, "thought")
  return ms !== undefined && ms >= 0
    ? `Thought for ${Math.max(1, Math.round(ms / 1000))}s`
    : "Thoughts"
}
