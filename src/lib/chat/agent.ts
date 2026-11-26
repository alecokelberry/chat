// A chat: one Agents SDK AIChatAgent (a Durable Object) per chat, its
// messages in its own SQLite. A browser talks to it over a WebSocket
// (src/lib/chat/route.ts). Each send saves the message and streams the
// reply from src/lib/ai back to every open tab; Stop aborts the stream and
// the SDK keeps what arrived, and a dropped connection picks the stream
// back up from the SDK's buffer. A failed reply sends the chat a short
// reason (replyError); Retry asks again in its place (regenerate).
import {
  AIChatAgent,
  type ChatResponseResult,
  type OnChatMessageOptions,
} from "@cloudflare/ai-chat"
import { MessageType } from "@cloudflare/ai-chat/types"

import { replyError, streamReply } from "@/lib/ai"

export class ChatAgent extends AIChatAgent<Env> {
  // The name (user id and chat id) goes to that user's own browser only.
  static options = { sendIdentityOnConnect: true }

  override async onChatMessage(
    _onFinish: unknown,
    options?: OnChatMessageOptions
  ) {
    const result = await streamReply(this.messages, options?.abortSignal)
    return result.toUIMessageStreamResponse({ onError: replyError })
  }

  // The tab that pressed Stop stops showing words at once, but the server
  // keeps the words that reach it before the Stop does, and the SDK sends
  // the saved reply to every tab but that one. Sending it there too makes
  // the screen settle on what was saved.
  override onChatResponse(result: ChatResponseResult) {
    if (result.status !== "aborted") return
    this.broadcast(
      JSON.stringify({
        type: MessageType.CF_AGENT_CHAT_MESSAGES,
        messages: this.messages,
      })
    )
  }
}
