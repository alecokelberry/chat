// The Library's index (what the browser needs of it is in
// src/lib/chat/library-items.ts, which imports no Drizzle): a D1 row per attachment of a question (an image or
// a document, src/lib/chat/attachments.ts), across all of a user's chats,
// for the Library page (src/routes/_app/library.tsx). The files themselves
// stay inside their chat's agent; a row holds only what the page lists
// (name, kind, size, when it was sent) and where the file is, and the page
// shows an image by asking that chat's agent for it (fileUrl). A chat's
// agent writes its rows in the same batch as Search's index
// (indexMessages, src/lib/chat/message-index.ts), so one path keeps both
// up to date and indexes an older chat whole. Rows belong to their chat's
// row in the chat list, so deleting a chat (or its user) deletes them too.
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm"
import {
  type BaseSQLiteDatabase,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import type { UIMessage } from "ai"

import { isDocument } from "@/lib/chat/documents"
import {
  ATTACHMENT_KINDS,
  LIBRARY_PAGE,
  type AttachmentKind,
  type LibraryItem,
  type LibraryQuery,
  type LibraryTab,
} from "@/lib/chat/library-items"
import { field } from "@/lib/field"
import { chat, type ChatOwner } from "@/lib/chat/store"

/** One attachment. `seq` is its own integer key, never reused
 *  (AUTOINCREMENT), so a row's address (fileUrl) changes whenever its file
 *  does: an edit that swaps a file deletes its row and adds a new one. */
export const attachment = sqliteTable(
  "attachment",
  {
    seq: integer().primaryKey({ autoIncrement: true }),
    userId: text().notNull(),
    chatId: text().notNull(),
    messageId: text().notNull(),
    /** The part's place among its question's parts. */
    part: integer().notNull(),
    name: text().notNull(),
    kind: text({ enum: ATTACHMENT_KINDS }).notNull(),
    /** Bytes for an image, characters for a document. */
    size: integer().notNull(),
    /** When its question was sent (epoch ms). */
    at: integer().notNull(),
  },
  (table) => [
    uniqueIndex("attachment_part_idx").on(
      table.userId,
      table.chatId,
      table.messageId,
      table.part
    ),
    index("attachment_user_at_idx").on(table.userId, table.at, table.seq),
    foreignKey({
      columns: [table.userId, table.chatId],
      foreignColumns: [chat.userId, chat.id],
    }).onDelete("cascade"),
  ]
)

/** What a question's attachment puts in its row. `at` is null when the
 *  chat doesn't say when it was sent, and the chat's start stands in. */
export type AttachmentRow = {
  messageId: string
  part: number
  name: string
  kind: AttachmentKind
  size: number
  at: number | null
}

/** The longest file name a row keeps: a name comes from the browser. */
const NAME_MAX = 255

/** The bytes a base64 data URL holds, near enough for a size. */
const dataBytes = (url: string) =>
  Math.floor(((url.length - url.indexOf(",") - 1) * 3) / 4)

/** A question part's row, or null for a part that isn't an attachment. */
function rowOf(
  part: UIMessage["parts"][number]
): Pick<AttachmentRow, "name" | "kind" | "size"> | null {
  if (part.type === "file" && part.mediaType.startsWith("image/"))
    return {
      name: (part.filename ?? "Image").slice(0, NAME_MAX),
      kind: "image",
      size: dataBytes(part.url),
    }
  if (isDocument(part))
    return {
      name: part.data.name.slice(0, NAME_MAX),
      kind: part.data.mediaType === "application/pdf" ? "pdf" : "text",
      size: part.data.text.length,
    }
  return null
}

/** When the send of the question at `index` reached the server: its
 *  reply's `started` (src/lib/chat/reply-metadata.ts), or null. */
function sentAt(messages: readonly UIMessage[], index: number) {
  const reply = messages[index + 1]
  const started =
    reply?.role === "assistant" ? field(reply.metadata, "started") : undefined
  return typeof started === "number" ? started : null
}

/** The attachments of `messages`' questions, in order. */
export function attachmentsOf(messages: readonly UIMessage[]): AttachmentRow[] {
  return messages.flatMap((message, index) =>
    message.role === "user"
      ? message.parts.flatMap((part, at) => {
          const row = rowOf(part)
          return row === null
            ? []
            : [
                {
                  messageId: message.id,
                  part: at,
                  ...row,
                  at: sentAt(messages, index),
                },
              ]
        })
      : []
  )
}

/** A statement for D1: its SQL and what to bind. */
export type Statement = { sql: string; params: unknown[] }

/** The statements that bring the chat's rows up to `messages`, the whole
 *  chat, run in indexMessages' batch: drop the rows of messages it no
 *  longer holds, and of `changed` messages' parts that are gone or now
 *  hold another file (another name, kind or size), then add `changed`'s
 *  attachments. An unchanged attachment keeps its row (and its seq). A
 *  row is a few names and numbers, so one statement holds them all, well
 *  under D1's 2 MB for a bound value. */
export function attachmentStatements(
  { userId, id }: ChatOwner,
  messages: readonly UIMessage[],
  changed: readonly UIMessage[]
): Statement[] {
  const changedIds = new Set(changed.map((message) => message.id))
  // From the whole chat, since a question's time is on the reply after it.
  const rows = JSON.stringify(
    attachmentsOf(messages).filter((row) => changedIds.has(row.messageId))
  )
  return [
    {
      sql: `delete from attachment where userId = ?1 and chatId = ?2
        and messageId not in (select value from json_each(?3))`,
      params: [
        userId,
        id,
        JSON.stringify(messages.map((message) => message.id)),
      ],
    },
    {
      sql: `delete from attachment where userId = ?1 and chatId = ?2
        and messageId in (select value from json_each(?3))
        and not exists (select 1 from json_each(?4)
          where value ->> 'messageId' = attachment.messageId
          and value ->> 'part' = attachment.part
          and value ->> 'name' = attachment.name
          and value ->> 'kind' = attachment.kind
          and value ->> 'size' = attachment.size)`,
      params: [userId, id, JSON.stringify([...changedIds]), rows],
    },
    // `where true` tells SQLite the upsert's ON CONFLICT isn't the
    // SELECT's. The chat's start stands in for a time the chat doesn't
    // hold.
    {
      sql: `insert into attachment
        (userId, chatId, messageId, part, name, kind, size, at)
        select ?1, ?2, value ->> 'messageId', value ->> 'part',
          value ->> 'name', value ->> 'kind', value ->> 'size',
          coalesce(value ->> 'at',
            (select createdAt from chat where userId = ?1 and id = ?2))
        from json_each(?3) where true
        on conflict do nothing`,
      params: [userId, id, rows],
    },
  ]
}

/** A to Z as a to z, and nothing else, as SQLite's lower() does. */
const foldAscii = (text: string) =>
  text.replaceAll(/[A-Z]/g, (letter) => letter.toLowerCase())

const KINDS_OF: Record<LibraryTab, AttachmentKind[] | null> = {
  all: null,
  images: ["image"],
  files: ["pdf", "text"],
}

/** One page of the user's attachments that `query` asks for, from `db`
 *  (D1's Drizzle in the app). A name matches anywhere (SQLite's instr,
 *  so nothing typed is read as a pattern), A to Z in either case: D1's
 *  lower() folds only ASCII, so what's typed is folded the same way. */
export async function listAttachments<Result>(
  db: BaseSQLiteDatabase<"async", Result>,
  userId: string,
  { tab, name, order, cursor }: LibraryQuery
): Promise<LibraryItem[]> {
  const newest = order === "newest"
  const before = newest ? lt : gt
  const kinds = KINDS_OF[tab]
  return db
    .select({
      seq: attachment.seq,
      chatId: attachment.chatId,
      messageId: attachment.messageId,
      part: attachment.part,
      name: attachment.name,
      kind: attachment.kind,
      size: attachment.size,
      at: attachment.at,
    })
    .from(attachment)
    .where(
      and(
        eq(attachment.userId, userId),
        kinds === null ? undefined : inArray(attachment.kind, kinds),
        name === ""
          ? undefined
          : sql`instr(lower(${attachment.name}), ${foldAscii(name)}) > 0`,
        cursor === undefined
          ? undefined
          : or(
              before(attachment.at, cursor.at),
              and(
                eq(attachment.at, cursor.at),
                before(attachment.seq, cursor.seq)
              )
            )
      )
    )
    .orderBy(
      ...(newest
        ? [desc(attachment.at), desc(attachment.seq)]
        : [asc(attachment.at), asc(attachment.seq)])
    )
    .limit(LIBRARY_PAGE)
}
