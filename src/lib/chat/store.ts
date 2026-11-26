// The chat list in D1, through Drizzle: each chat's id, title, pin and last
// activity, per user. The table here is the schema: `pnpm db:generate`
// (drizzle-kit, drizzle.config.ts) writes its migrations into migrations/. The
// chat's agent writes it (src/lib/chat/agent.ts): a send adds the chat or
// moves it up, and the first reply gives it a title. The sidebar reads it,
// and its menu renames, pins and deletes (src/lib/chat/list.ts).
import { and, desc, eq, isNull } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

/** Better Auth's user table (migrations/0001_auth.sql makes it), named here
 *  only so a chat can reference its owner. */
const user = sqliteTable("user", { id: text().primaryKey() })

/** The browser makes a chat's id, so it's unique only per user: the key is
 *  both. Times are milliseconds since 1970. */
export const chat = sqliteTable(
  "chat",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    id: text().notNull(),
    /** Null until the first reply names it. Lightning names only a chat
     *  without one, so a title, once set, is kept. */
    title: text(),
    /** Listed under Pinned, above the day groups. */
    pinned: integer({ mode: "boolean" }).notNull().default(false),
    createdAt: integer().notNull(),
    updatedAt: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index("chat_userId_updatedAt_idx").on(table.userId, table.updatedAt),
  ]
)

/** A row in the sidebar. */
export type ChatSummary = {
  id: string
  title: string | null
  pinned: boolean
  updatedAt: number
}

/** Whose chat, and which: the chat's agent knows both from its name. */
export type ChatOwner = { userId: string; id: string }

const db = (d1: D1Database) => drizzle(d1)
const isChat = ({ userId, id }: ChatOwner) =>
  and(eq(chat.userId, userId), eq(chat.id, id))

/** Adds the chat, or moves it to the top: it just got a message. */
export async function touchChat(d1: D1Database, { userId, id }: ChatOwner) {
  const now = Date.now()
  await db(d1)
    .insert(chat)
    .values({ userId, id, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [chat.userId, chat.id],
      set: { updatedAt: now },
    })
}

/** Whether the chat still waits for its title. */
export async function isUntitled(
  d1: D1Database,
  owner: ChatOwner
): Promise<boolean> {
  const row = await db(d1)
    .select({ title: chat.title })
    .from(chat)
    .where(isChat(owner))
    .get()
  return row !== undefined && row.title === null
}

/** Titles the chat, unless it already has a title (a rename's, or an
 *  earlier try's): the check and the write are one statement. */
export async function setFirstTitle(
  d1: D1Database,
  owner: ChatOwner,
  title: string
) {
  await db(d1)
    .update(chat)
    .set({ title })
    .where(and(isChat(owner), isNull(chat.title)))
}

/** Renames, pins or unpins the chat. A renamed chat keeps its title:
 *  Lightning names only a chat without one. Whether the user has the
 *  chat. */
export async function updateChat(
  d1: D1Database,
  owner: ChatOwner,
  fields: Partial<Pick<ChatSummary, "title" | "pinned">>
): Promise<boolean> {
  const rows = await db(d1)
    .update(chat)
    .set(fields)
    .where(isChat(owner))
    .returning({ id: chat.id })
  return rows.length > 0
}

/** Whether the user has the chat. */
export async function hasChat(
  d1: D1Database,
  owner: ChatOwner
): Promise<boolean> {
  const row = await db(d1)
    .select({ id: chat.id })
    .from(chat)
    .where(isChat(owner))
    .get()
  return row !== undefined
}

/** Takes the chat off the user's list for good. */
export async function deleteChatRow(d1: D1Database, owner: ChatOwner) {
  await db(d1).delete(chat).where(isChat(owner))
}

/** The user's chats, pinned ones first, then latest activity first, so
 *  the drawer's first screen of rows starts with the pins. */
export async function listChats(
  d1: D1Database,
  userId: string
): Promise<ChatSummary[]> {
  return db(d1)
    .select({
      id: chat.id,
      title: chat.title,
      pinned: chat.pinned,
      updatedAt: chat.updatedAt,
    })
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(desc(chat.pinned), desc(chat.updatedAt), chat.id)
}
