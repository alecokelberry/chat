// The words of every chat's messages, for Search (src/components/chat/
// search-chats.tsx): a D1 table of each message's text, and over it an
// FTS5 full-text index that SQLite keeps in step through triggers
// (migrations/…_message_fts.sql), so the tokenising and the ranking run in
// D1, never in the Worker's 10 ms. A chat's agent writes it after every
// reply, finished, stopped or failed (src/lib/chat/agent.ts): that turn's
// question and reply, and it drops whatever the chat no longer holds, so
// an edited question's old text and the replies an edit or Retry replaced
// stop matching. A question's attachments count by their file names. A
// chat whose words were never all indexed (one from before the index, or
// the tour, put back whole) is indexed whole instead:
// on its next reply, or sooner, when Search opens and asks the agents of a
// few such chats to (indexOlderChats, src/lib/chat/list.ts). Rows belong to their chat's row in the chat list, so
// deleting a chat (or its user) deletes its text too.
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import {
  foreignKey,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import type { UIMessage } from "ai"

import { isDocument } from "@/lib/chat/documents"
import { attachmentStatements } from "@/lib/chat/library"
import { MATCH_END, MATCH_START } from "@/lib/chat/match-marks"
import { chat, type ChatOwner } from "@/lib/chat/store"

/** One message's text. `seq` is the index's row id: an integer key of its
 *  own, since FTS5 points at rows by an integer that must never change. */
export const messageText = sqliteTable(
  "message_text",
  {
    seq: integer().primaryKey(),
    userId: text().notNull(),
    chatId: text().notNull(),
    messageId: text().notNull(),
    text: text().notNull(),
  },
  (table) => [
    uniqueIndex("message_text_message_idx").on(
      table.userId,
      table.chatId,
      table.messageId
    ),
    foreignKey({
      columns: [table.userId, table.chatId],
      foreignColumns: [chat.userId, chat.id],
    }).onDelete("cascade"),
  ]
)

/** The most text a message keeps in the index: a very long reply still
 *  matches on its first 100,000 characters. */
const TEXT_MAX = 100_000

/** A part's words: a text part's text, and an attachment's file name
 *  (src/lib/chat/attachments.ts), but not a document's text, which a
 *  search would match on every word of a long file. */
function partWords(part: UIMessage["parts"][number]) {
  if (part.type === "text") return part.text
  if (part.type === "file") return nameWords(part.filename ?? "")
  return isDocument(part) ? nameWords(part.data.name) : ""
}

/** A file name, then its words split where the index wouldn't: at a
 *  lower-to-upper case change and between letters and digits, so "list"
 *  finds PackingList.md and "4021" finds IMG4021.jpg. */
const nameWords = (name: string) => {
  const split = name
    .replaceAll(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .replaceAll(/(\p{L})(\p{N})|(\p{N})(\p{L})/gu, "$1$3 $2$4")
  return split === name ? name : `${name} ${split}`
}

/** A message's words: its text parts (a question, a reply's answer) and
 *  its attachments' names, not its thinking or tool calls. */
export function wordsOf(message: UIMessage) {
  return message.parts
    .map(partWords)
    .filter((words) => words !== "")
    .join("\n")
    .replaceAll(MATCH_START, "")
    .replaceAll(MATCH_END, "")
    .slice(0, TEXT_MAX)
    .trim()
}

const db = (d1: D1Database) => drizzle(d1)

/** The most JSON one statement carries: D1 refuses a bound value or row of
 *  about 2 MB, so a chat of many long messages is written in several. */
const JSON_MAX = 200_000

/** `rows` as JSON lists of at most `max` characters each (a row longer than
 *  that alone, none holds more than TEXT_MAX of text plus its escapes). */
export function jsonChunks<Row>(rows: readonly Row[], max = JSON_MAX) {
  const chunks: string[] = []
  let current: string[] = []
  let size = 2
  for (const row of rows) {
    const json = JSON.stringify(row)
    if (current.length > 0 && size + json.length + 1 > max) {
      chunks.push(`[${current.join(",")}]`)
      current = []
      size = 2
    }
    current.push(json)
    size += json.length + 1
  }
  if (current.length > 0) chunks.push(`[${current.join(",")}]`)
  return chunks
}

/** Brings the chat's text in the index, and its files in the Library's
 *  (src/lib/chat/library.ts), up to `messages`, the whole chat:
 *  drops what it no longer holds, then writes `changed` (the turn's
 *  question and reply, or every message), and with `whole` marks the chat
 *  indexed (src/lib/chat/store.ts). A few statements, the message list sent as
 *  JSON, in pieces when a chat's text is long. If the chat's row is gone
 *  (deleted mid-reply), the write fails and nothing changes. */
export async function indexMessages(
  d1: D1Database,
  { userId, id }: ChatOwner,
  messages: readonly UIMessage[],
  changed: readonly UIMessage[],
  whole: boolean
) {
  const ids = JSON.stringify(messages.map((message) => message.id))
  const rows = jsonChunks(
    changed
      .map((message) => ({ id: message.id, text: wordsOf(message) }))
      .filter((row) => row.text !== "")
  )
  // Raw D1 statements: Drizzle's builder can't say "not in json_each",
  // nor an upsert from a SELECT. One batch, so all or none apply.
  await d1.batch([
    d1
      .prepare(
        `delete from message_text where userId = ?1 and chatId = ?2
        and messageId not in (select value from json_each(?3))`
      )
      .bind(userId, id, ids),
    // An unchanged message is left alone, so its index entry isn't
    // rewritten. `where true` tells SQLite the upsert's ON CONFLICT isn't
    // the SELECT's.
    ...rows.map((json) =>
      d1
        .prepare(
          `insert into message_text (userId, chatId, messageId, text)
        select ?1, ?2, value ->> 'id', value ->> 'text'
        from json_each(?3) where true
        on conflict (userId, chatId, messageId) do update
        set text = excluded.text where text is not excluded.text`
        )
        .bind(userId, id, json)
    ),
    ...attachmentStatements({ userId, id }, messages, changed).map(
      ({ sql, params }) => d1.prepare(sql).bind(...params)
    ),
    ...(whole
      ? [
          d1
            .prepare(
              "update chat set indexed = 1 where userId = ?1 and id = ?2"
            )
            .bind(userId, id),
        ]
      : []),
  ])
}

/** The FTS5 query for what was typed: its words, each quoted, so nothing
 *  typed is read as FTS5's syntax, the last one a prefix, since it may be
 *  half typed. Null below two letters. */
export function matchQuery(typed: string): string | null {
  const words = typed.match(/[\p{L}\p{N}]+/gu) ?? []
  if (words.join("").length < 2) return null
  return words
    .map((word, index) => `"${word}"${index === words.length - 1 ? "*" : ""}`)
    .join(" ")
}

/** A chat whose messages hold the words: its best matching line, the
 *  words between MATCH_START and MATCH_END. */
export type MessageMatch = { id: string; snippet: string }

/** The most chats a search returns. */
const MATCHES_MAX = 20

/** The user's chats whose messages hold every word typed, best match
 *  first, one per chat. */
export async function searchMessages(
  d1: D1Database,
  userId: string,
  typed: string
): Promise<MessageMatch[]> {
  const query = matchQuery(typed)
  if (query === null) return []
  // Several messages of one chat can match: take the best few hundred,
  // then the first of each chat.
  const rows = await db(d1).all<MessageMatch>(sql`
    select message_text.chatId as id,
      snippet(message_fts, 0, ${MATCH_START}, ${MATCH_END}, '…', 12) as snippet
    from message_fts join message_text on message_text.seq = message_fts.rowid
    where message_fts match ${query} and message_text.userId = ${userId}
    order by message_fts.rank limit 200`)
  const best = new Map<string, MessageMatch>()
  for (const row of rows) if (!best.has(row.id)) best.set(row.id, row)
  return [...best.values()].slice(0, MATCHES_MAX)
}
