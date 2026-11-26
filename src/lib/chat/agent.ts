// A chat: one Agents SDK AIChatAgent (a Durable Object) per chat, its
// messages in its own SQLite. A browser talks to it over a WebSocket
// (src/lib/chat/route.ts). Each send saves the message and streams the
// reply from src/lib/ai back to every open tab; Stop aborts the stream and
// the SDK keeps what arrived, and a dropped connection picks the stream
// back up from the SDK's buffer. A failed reply sends the chat a short
// reason (replyError); Retry asks again in its place (regenerate). An
// edited question arrives as a send that ends at it, under its old id: the
// SDK saves it and deletes every message after it (persistMessages'
// stale-row cleanup), so nothing here handles edits.
//
// It also keeps the chat's row in the D1 chat list (src/lib/chat/store.ts):
// a send adds the chat or moves it to the top, and once the first reply is
// in, Lightning names it (if that fails, the next reply tries again). A
// chat that already has a title, a rename's included, keeps it.
// After either, it tells its open tabs CHATS_CHANGED, so their sidebars
// load the list again; a rename or pin from the menu asks it to as well
// (chatsChanged).
//
// Each reply's metadata records who answered and how long it took, from
// the send to the last word, or to Stop or a failure, and how long the
// model thought, from its first thought to the end of its last (or to
// Stop), so the chat shows them after a reload too.
import {
  AIChatAgent,
  type ChatResponseResult,
  type OnChatMessageOptions,
} from "@cloudflare/ai-chat"
import type { UIMessage } from "ai"

import { nameChat, replyError, streamReply } from "@/lib/ai"
import { lastModel } from "@/lib/ai/models"
import { CHATS_CHANGED } from "@/lib/chat/events"
import { stoppedMetadata, type ReplyMetadata } from "@/lib/chat/reply-metadata"
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

  /** Tells this chat's open tabs the list changed. An RPC method, for
   *  the Worker (src/lib/chat/list.ts): browsers can't call it. */
  chatsChanged() {
    this.broadcast(CHATS_CHANGED)
  }

  override async onChatMessage(
    _onFinish: unknown,
    options?: OnChatMessageOptions
  ) {
    const started = Date.now()
    const model = lastModel(this.messages).key
    await touchChat(this.env.DB, this.owner)
    this.broadcast(CHATS_CHANGED)
    const result = await streamReply(this.messages, options?.abortSignal)
    let thinking: number | undefined
    return result.toUIMessageStreamResponse({
      onError: replyError,
      messageMetadata: ({ part }): ReplyMetadata | undefined => {
        if (part.type === "start") return { model, started }
        if (part.type === "reasoning-start" && thinking === undefined) {
          thinking = Date.now()
          return { thinking }
        }
        if (part.type === "reasoning-end" && thinking !== undefined)
          return { thought: Date.now() - thinking }
        // At each step's end, not the reply's: the SDK replaces the finish
        // chunk's metadata on its way to the browser.
        if (part.type === "finish-step") return { ms: Date.now() - started }
        return undefined
      },
    })
  }

  override async onChatResponse(result: ChatResponseResult) {
    if (result.status === "aborted" || result.status === "error")
      await this.saveTimeOf(result.message)
    if (result.status !== "error") await this.nameIfUntitled()
  }

  // A stopped or failed reply ends without a finish, so its time is the
  // time to Stop or to the failure. The tab that pressed Stop stops
  // showing words at once, but the server keeps the words that reach it
  // before the Stop does, and the SDK sends the saved reply to every tab
  // but that one. Saving the time sends the reply to every tab, so that
  // one settles on what was saved too.
  private async saveTimeOf(reply: UIMessage) {
    const ended = stoppedMetadata(reply.metadata, Date.now())
    await this.persistMessages(
      this.messages.map((message) =>
        message.id === reply.id ? { ...message, metadata: ended } : message
      )
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
