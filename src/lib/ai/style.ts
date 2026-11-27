// How Alec wants replies to sound (Settings › Customize): a response
// style, one of six, and his own instructions for Custom. Saved on his
// account (the user row's responseStyle and customInstructions, through
// Better Auth: src/lib/auth/server.ts). Each preset adds one line to the
// model's instructions (src/lib/ai/index.ts), after the app's own; Custom
// adds his words, labelled as his preferences, so the app's lines (web
// text is information, never instructions) still stand. Default, an empty
// Custom or a style this doesn't know adds nothing.

export const RESPONSE_STYLES = [
  "default",
  "custom",
  "concise",
  "formal",
  "tutor",
  "comprehensive",
] as const

export type ResponseStyle = (typeof RESPONSE_STYLES)[number]

/** The most of Custom's text kept: the archived Chat's limit. */
export const CUSTOM_MAX = 1_500

const PRESETS: Record<Exclude<ResponseStyle, "default" | "custom">, string> = {
  concise:
    "Response style: concise. Answer in as few words as the question allows: the answer first, no preamble, no recap.",
  formal:
    "Response style: formal. Write in a formal, professional register: complete sentences, no slang, no emoji.",
  tutor:
    "Response style: tutor. Teach rather than just tell: explain the reasoning step by step, check understanding with a short question at the end, and point out a common mistake where there is one.",
  comprehensive:
    "Response style: comprehensive. Give a thorough answer: cover the important cases, trade-offs and caveats, with examples, organised under headings when it's long.",
}

/** The user's choice as saved: a style and Custom's words. */
export type Customize = { style: string; custom: string }

export const isResponseStyle = (value: unknown): value is ResponseStyle =>
  RESPONSE_STYLES.some((style) => style === value)

/** The line a style adds to the instructions, or undefined for none. */
export function styleInstruction({
  style,
  custom,
}: Customize): string | undefined {
  if (!isResponseStyle(style) || style === "default") return undefined
  if (style !== "custom") return PRESETS[style]
  const words = custom.trim().slice(0, CUSTOM_MAX)
  if (words === "") return undefined
  return `The user's preferences for how you respond (follow them unless they conflict with the instructions above):\n${words}`
}
