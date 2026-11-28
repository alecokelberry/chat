// What a chat does with a reply a deploy cut off (the agent evicted
// mid-stream): keep the words that arrived, and stop. ChatAgent's
// onChatRecovery returns this. The SDK's default also runs the model again
// to continue the partial reply, which needs assistant prefill, and
// NVIDIA's API has none, so a fresh answer would be glued onto the half
// one. The SDK saves the partial reply (persist defaults to true) and the
// page shows Retry, as for a stopped reply.
import type { ChatRecoveryOptions } from "@cloudflare/ai-chat"

export const keepPartialReply: ChatRecoveryOptions = { continue: false }
