// Every model call goes through here (AGENTS.md). A reply streams from the
// model the chat's last message names (src/lib/ai/models.ts), with that
// model's thinking switch, through the Cloudflare AI Gateway "chat" (free
// plan), which logs each request with its token usage: the gateway is only
// a base URL in front of NVIDIA's OpenAI-compatible API, plus its own
// token. With MOCK_MODEL "1" the mock model answers instead.
import { env } from "cloudflare:workers"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { convertToModelMessages, streamText, type UIMessage } from "ai"

import { mockModel } from "@/lib/ai/mock"
import { lastModel } from "@/lib/ai/models"

function model(id: string) {
  if (env.MOCK_MODEL === "1") return mockModel(id)
  const nvidia = createOpenAICompatible({
    name: "nvidia",
    // AI_GATEWAY_URL is the gateway's NVIDIA route, ending in
    // /custom-nvidia/v1; the AI SDK adds /chat/completions.
    baseURL: env.AI_GATEWAY_URL,
    apiKey: env.NVIDIA_API_KEY,
    headers: { "cf-aig-authorization": `Bearer ${env.AI_GATEWAY_TOKEN}` },
    includeUsage: true,
  })
  return nvidia.chatModel(id)
}

/** Streams the assistant's reply to a conversation. */
export async function streamReply(
  messages: UIMessage[],
  abortSignal: AbortSignal | undefined
) {
  const chosen = lastModel(messages)
  return streamText({
    model: model(chosen.id),
    messages: await convertToModelMessages(messages),
    abortSignal,
    // NVIDIA's default cap cuts long answers short; thinking models also
    // spend this budget on thinking (docs/nvidia.md).
    maxOutputTokens: 16_384,
    providerOptions: { nvidia: { chat_template_kwargs: chosen.chatTemplate } },
  })
}
