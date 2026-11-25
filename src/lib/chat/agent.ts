// A chat: one Agents SDK AIChatAgent (a Durable Object) per chat, its
// messages in its own SQLite. A browser talks to it over a WebSocket
// (src/lib/chat/route.ts). Each send saves the message and streams the
// reply from src/lib/ai back to every open tab; Stop aborts the stream and
// the SDK keeps what arrived, and a dropped connection picks the stream
// back up from the SDK's buffer.
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat"

import { streamReply } from "@/lib/ai"

export class ChatAgent extends AIChatAgent<Env> {
  // The name (user id and chat id) goes to that user's own browser only.
  static options = { sendIdentityOnConnect: true }

  override async onChatMessage(
    _onFinish: unknown,
    options?: OnChatMessageOptions
  ) {
    const result = await streamReply(this.messages, options?.abortSignal)
    return result.toUIMessageStreamResponse()
  }
}
