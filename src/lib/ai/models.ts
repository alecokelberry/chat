// The models Chat offers (docs/nvidia.md): each one's short name (the
// picker's button), full name (its list), NVIDIA id, whether it can see
// images (Super, Nano Omni, Kimi and Mistral can) and the chat template
// switch that turns its thinking on or off (Kimi and Mistral send none:
// unmeasured, so they think however NVIDIA serves them). Super is the default with thinking off; Ultra
// is the one that thinks hard. Shared by the server (src/lib/ai) and the
// composer's picker, so it imports only a tiny data reader.
// A message records the model it was sent with in its metadata, which is
// how a chat remembers its last one, and the browser's time zone, which
// the model is told (src/lib/ai/index.ts).

import { field } from "@/lib/field"

export const MODELS = [
  {
    key: "super",
    name: "Super",
    fullName: "Nemotron 3.5 Super",
    id: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    seesImages: true,
    chatTemplate: { enable_thinking: false },
  },
  {
    key: "ultra",
    name: "Ultra",
    fullName: "Nemotron 3 Ultra",
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    seesImages: false,
    chatTemplate: { enable_thinking: true },
  },
  {
    key: "nano-omni",
    name: "Nano Omni",
    fullName: "Nemotron 3 Nano Omni",
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    seesImages: true,
    chatTemplate: { enable_thinking: false },
  },
  {
    key: "lightning",
    name: "Lightning",
    fullName: "Nemotron 3.5 Lightning",
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    seesImages: false,
    chatTemplate: { enable_thinking: false },
  },
  // Kimi and Mistral are not NVIDIA's own: their thinking switch is not
  // verified against the real API yet (docs/nvidia.md), so they send no
  // chat template and think however NVIDIA serves them by default.
  {
    key: "kimi",
    name: "Kimi",
    fullName: "Kimi K3.1 Pro",
    id: "moonshotai/kimi-k3.1-pro",
    seesImages: true,
    chatTemplate: {},
  },
  {
    key: "mistral",
    name: "Mistral",
    fullName: "Mistral Large 4",
    id: "mistralai/mistral-large-4-1t-a52b",
    seesImages: true,
    chatTemplate: {},
  },
] as const

type Model = (typeof MODELS)[number]
export type ModelKey = Model["key"]

const [DEFAULT, , , LIGHTNING_MODEL] = MODELS
/** The quickest: it names each chat after its first reply. */
export const LIGHTNING = LIGHTNING_MODEL satisfies { key: "lightning" }

export const DEFAULT_MODEL: ModelKey = DEFAULT.key

type Messages = readonly { role: string; metadata?: unknown }[]

/** A field of the last question's metadata, unchecked: metadata comes
 *  from the browser, so each reader below checks its own. */
function lastAsked(messages: Messages, key: "model" | "timeZone"): unknown {
  return field(messages.findLast((m) => m.role === "user")?.metadata, key)
}

/** The time zone the last question was sent from, if it names a real
 *  one, else UTC. */
export function lastTimeZone(messages: Messages): string {
  const zone = lastAsked(messages, "timeZone")
  if (typeof zone !== "string" || zone.length > 64) return "UTC"
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
    }).resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

/** The model a chat goes on with: the one its last message was sent
 *  with, or Super for anything else. */
export const lastModel = (messages: Messages): Model =>
  modelOf(lastAsked(messages, "model"))

/** A model by its key, or Super for a key no model has. */
export const modelOf = (key: unknown): Model =>
  MODELS.find((model) => model.key === key) ?? DEFAULT
