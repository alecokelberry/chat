// The models Chat offers (docs/nvidia.md): each one's short name (the
// picker's button), full name (its list), NVIDIA id and the
// chat template switch that turns its thinking on or off. Super is the
// default with thinking off; Ultra is the one that thinks hard. Shared by
// the server (src/lib/ai) and the composer's picker, so it imports nothing.
// A message records the model it was sent with in its metadata, which is
// how a chat remembers its last one.

export const MODELS = [
  {
    key: "super",
    name: "Super",
    fullName: "Nemotron 3.5 Super",
    id: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    chatTemplate: { enable_thinking: false },
  },
  {
    key: "ultra",
    name: "Ultra",
    fullName: "Nemotron 3 Ultra",
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    chatTemplate: { enable_thinking: true },
  },
  {
    key: "nano-omni",
    name: "Nano Omni",
    fullName: "Nemotron 3 Nano Omni",
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    chatTemplate: { enable_thinking: false },
  },
  {
    key: "lightning",
    name: "Lightning",
    fullName: "Nemotron 3.5 Lightning",
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    chatTemplate: { enable_thinking: false },
  },
] as const

type Model = (typeof MODELS)[number]
export type ModelKey = Model["key"]

const [DEFAULT, , , LIGHTNING_MODEL] = MODELS
/** The quickest: it names each chat after its first reply. */
export const LIGHTNING = LIGHTNING_MODEL satisfies { key: "lightning" }

export const DEFAULT_MODEL: ModelKey = DEFAULT.key

/** The model a message's metadata names, or Super for anything else:
 *  metadata comes from the browser, so it's checked, never trusted. */
function modelOf(metadata: unknown): Model {
  const key =
    typeof metadata === "object" && metadata !== null && "model" in metadata
      ? metadata.model
      : undefined
  return MODELS.find((model) => model.key === key) ?? DEFAULT
}

/** The model a chat goes on with: the one its last message was sent with. */
export function lastModel(
  messages: readonly { role: string; metadata?: unknown }[]
): Model {
  return modelOf(messages.findLast((m) => m.role === "user")?.metadata)
}
