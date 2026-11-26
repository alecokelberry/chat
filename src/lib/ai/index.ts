// Every model call goes through here (AGENTS.md). A reply streams from the
// model the chat's last message names (src/lib/ai/models.ts), with that
// model's thinking switch, through the Cloudflare AI Gateway "chat" (free
// plan), which logs each request with its token usage: the gateway is only
// a base URL in front of NVIDIA's OpenAI-compatible API, plus its own
// token. With MOCK_MODEL "1" the mock model answers instead.
//
// When NVIDIA is busy (429, or 503 when its shared capacity is full), the AI
// SDK asks once more after a 2 s backoff (docs/nvidia.md › Errors); a
// second refusal ends the reply with an error the chat shows with Retry.
// The model never changes on its own: Alec picks it.
import { env } from "cloudflare:workers"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import {
  APICallError,
  convertToModelMessages,
  RetryError,
  streamText,
  type UIMessage,
} from "ai"

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
    // One quiet retry. The AI SDK retries any 408, 409, 429 or 5xx, and
    // only before the reply starts.
    maxRetries: 1,
    // replyError logs a failure; the default would also log the request,
    // which holds the whole chat.
    onError: () => undefined,
    // NVIDIA's default cap cuts long answers short; thinking models also
    // spend this budget on thinking (docs/nvidia.md).
    maxOutputTokens: 16_384,
    providerOptions: { nvidia: { chat_template_kwargs: chosen.chatTemplate } },
  })
}

/** What the chat shows when a reply fails. The status and message go to
 *  the log, never the request (it holds the chat). */
export function replyError(error: unknown): string {
  const cause = RetryError.isInstance(error) ? error.lastError : error
  const status = APICallError.isInstance(cause) ? cause.statusCode : undefined
  console.error(
    "Reply failed:",
    status,
    cause instanceof Error ? cause.message : String(cause)
  )
  return status === 429 || status === 503
    ? "NVIDIA is busy right now."
    : "Request failed."
}
