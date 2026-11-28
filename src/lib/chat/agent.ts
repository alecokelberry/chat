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
// (chatsChanged). Deleting the chat from the menu ends with deleteChat:
// its tabs are told to leave, and a schedule (a durable alarm, retried if
// it fails) runs the SDK's destroy() at least a second later, which wipes
// the agent's storage (messages, stream buffers, everything) and evicts it.
// destroy() aborts the agent, so it must not run before the RPC's answer
// has left: in the RPC itself, or from an alarm due at once, it can beat
// that answer, and the Worker then reports a delete that worked as failed.
// The SDK's own deferred destroy waits a second for the same reason; the
// scheduler rounds a delay down to a whole second, so it takes 2 to be sure.
//
// After every reply, finished, stopped or failed, it brings Search's index
// of the chat's words up to date (src/lib/chat/message-index.ts): that
// turn's question and reply, minus whatever an edit or Retry removed, or
// the whole chat if the index never held all of it (the chat's row says,
// as the send moves it up). Search also asks it to index itself whole
// (indexAll) when it opens, for a chat from before the index.
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
import { recordUsage } from "@/lib/chat/usage"
import { CHAT_DELETED, CHATS_CHANGED } from "@/lib/chat/events"
import { ownerOf } from "@/lib/chat/id"
import { indexMessages } from "@/lib/chat/message-index"
import { stoppedMetadata, type ReplyMetadata } from "@/lib/chat/reply-metadata"
import {
  getCustomize,
  isUntitled,
  setFirstTitle,
  touchChat,
  type ChatOwner,
} from "@/lib/chat/store"

const textOf = (message: UIMessage | undefined) =>
  (message?.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")

/** Seconds from a delete to its wipe: long enough for the delete's
 *  answer to reach the Worker first. The scheduler rounds the due time
 *  down to a whole second, so 2 waits 1 to 2 seconds. */
const WIPE_AFTER = 2

export class ChatAgent extends AIChatAgent<Env> {
  // The name (user id and chat id) goes to that user's own browser only.
  static options = { sendIdentityOnConnect: true }

  /** The user and the chat, from the agent's name (agentName). */
  private get owner(): ChatOwner {
    return ownerOf(this.name)
  }

  /** Tells this chat's open tabs the list changed. An RPC method, for
   *  the Worker (src/lib/chat/list.ts): browsers can't call it. */
  chatsChanged() {
    this.broadcast(CHATS_CHANGED)
  }

  /** Tells this chat's open tabs to leave, then deletes everything the
   *  agent keeps, for good, once the schedule runs at least a second later (see
   *  the top of this file). An RPC method,
   *  for the Worker (src/lib/chat/list.ts), once it has deleted the
   *  chat's row. */
  async deleteChat() {
    this.broadcast(CHAT_DELETED)
    await this.schedule(WIPE_AFTER, "wipe")
  }

  /** Replaces everything the chat holds with `messages`, stopping any
   *  reply still streaming, and shows them in its open tabs: the feature
   *  tour (src/lib/chat/tour.ts), loaded or refreshed. Clearing first, as
   *  the SDK's docs say to for history changed outside the chat, means a
   *  refresh drops whatever was asked since. An RPC method, for the Worker
   *  (src/lib/chat/list.ts), once it has written the chat's row. */
  async replaceMessages(messages: UIMessage[]) {
    this.resetTurnState()
    await this.sessions.session().clearMessages()
    await this.persistMessages(messages)
    this.broadcast(CHATS_CHANGED)
  }

  /** Puts every word the chat holds in Search's index and marks the chat
   *  indexed, an empty chat too. An RPC method, for the Worker
   *  (src/lib/chat/list.ts), on one of the user's unindexed chats. */
  async indexAll() {
    await indexMessages(
      this.env.DB,
      this.owner,
      this.messages,
      this.messages,
      true
    )
  }

  /** Whether Search's index held all the chat's words when this turn's
   *  send came in. */
  private indexed = true

  /** What deleteChat's schedule runs. */
  async wipe() {
    await this.destroy()
  }

  override async onChatMessage(
    _onFinish: unknown,
    options?: OnChatMessageOptions
  ) {
    const started = Date.now()
    const model = lastModel(this.messages).key
    // The owner's response style is read each turn, so a change in
    // Settings reaches the next message on any device.
    const [indexed, customize] = await Promise.all([
      touchChat(this.env.DB, this.owner),
      getCustomize(this.env.DB, this.owner.userId),
    ])
    this.indexed = indexed
    this.broadcast(CHATS_CHANGED)
    const result = await streamReply(
      this.messages,
      options?.abortSignal,
      customize,
      (tokens) => {
        // Best effort: a reply that isn't counted still answered.
        this.ctx.waitUntil(
          recordUsage(this.env.DB, {
            userId: this.owner.userId,
            model,
            ...tokens,
          }).catch((error: unknown) => {
            console.error("Couldn't count the reply's usage", error)
          })
        )
      }
    )
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
    await this.indexTurn()
  }

  /** Writes this turn's question and reply to Search's index, or the
   *  whole chat if the index didn't hold it all, and drops what the chat
   *  no longer holds. Best effort: a chat that fails to index still
   *  answered; that turn's words are only missing from Search. */
  private async indexTurn() {
    const question = this.messages.findLastIndex(
      (message) => message.role === "user"
    )
    const changed = this.indexed
      ? this.messages.slice(Math.max(question, 0))
      : this.messages
    try {
      await indexMessages(
        this.env.DB,
        this.owner,
        this.messages,
        changed,
        !this.indexed
      )
    } catch (error) {
      console.error("Couldn't index the chat's words for Search", error)
    }
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
