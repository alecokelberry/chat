// A chat: one Agents SDK AIChatAgent (a Durable Object) per chat, its
// messages in its own SQLite. A browser talks to it over a WebSocket
// (src/lib/chat/route.ts). Each send saves the message and streams the
// reply from src/lib/ai back to every open tab; Stop aborts the stream and
// the SDK keeps what arrived, and a dropped connection picks the stream
// back up from the SDK's buffer. A failed reply sends the chat a short
// reason (replyError); Retry asks again in its place (regenerate).
//
// It also keeps the chat's row in the D1 chat list (src/lib/chat/store.ts):
// a send adds the chat or moves it to the top, and once the first reply is
// in, Lightning names it (if that fails, the next reply tries again).
// After either, it tells its open tabs CHATS_CHANGED, so their sidebars
// load the list again.
import {
  AIChatAgent,
  type ChatResponseResult,
  type OnChatMessageOptions,
} from "@cloudflare/ai-chat"
import { MessageType } from "@cloudflare/ai-chat/types"
import type { UIMessage } from "ai"

import { nameChat, replyError, streamReply } from "@/lib/ai"
import { CHATS_CHANGED } from "@/lib/chat/events"
import {
  isUntitled,
  setFirstTitle,
  touchChat,
  type ChatOwner,
} from "@/lib/chat/store"

const textOf = (message: UIMessage | undefined) =>
  (message?.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")

export class ChatAgent extends AIChatAgent<Env> {
  // The name (user id and chat id) goes to that user's own browser only.
  static options = { sendIdentityOnConnect: true }

  /** The user and the chat, from the agent's name (src/lib/chat/route.ts):
   *  `<user id>:<chat id>`. */
  private get owner(): ChatOwner {
    const at = this.name.lastIndexOf(":")
    return { userId: this.name.slice(0, at), id: this.name.slice(at + 1) }
  }

  override async onChatMessage(
    _onFinish: unknown,
    options?: OnChatMessageOptions
  ) {
    await touchChat(this.env.DB, this.owner)
    this.broadcast(CHATS_CHANGED)
    const result = await streamReply(this.messages, options?.abortSignal)
    return result.toUIMessageStreamResponse({ onError: replyError })
  }

  override async onChatResponse(result: ChatResponseResult) {
    if (result.status === "aborted") this.settleStoppedTab()
    if (result.status !== "error") await this.nameIfUntitled()
  }

  // The tab that pressed Stop stops showing words at once, but the server
  // keeps the words that reach it before the Stop does, and the SDK sends
  // the saved reply to every tab but that one. Sending it there too makes
  // the screen settle on what was saved.
  private settleStoppedTab() {
    this.broadcast(
      JSON.stringify({
        type: MessageType.CF_AGENT_CHAT_MESSAGES,
        messages: this.messages,
      })
    )
  }

  // Named from the first question and the first reply (a stopped one
  // counts: it's what the chat holds), even when an earlier try failed.
  private async nameIfUntitled() {
    const first = (role: UIMessage["role"]) =>
      textOf(this.messages.find((message) => message.role === role))
    const [question, reply] = [first("user"), first("assistant")]
    if (reply === "" || !(await isUntitled(this.env.DB, this.owner))) return
    const title = await nameChat(question, reply)
    if (title === null) return
    await setFirstTitle(this.env.DB, this.owner, title)
    this.broadcast(CHATS_CHANGED)
  }
}
