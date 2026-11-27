// What each reply used, for Settings › Usage: a D1 row per finished or
// stopped reply with its model and its tokens in and out, written by the
// chat's agent (src/lib/chat/agent.ts) from the AI SDK's own count. Kept
// when its chat is deleted, since Usage counts all time. Read back summed
// per model in D1, never row by row in the Worker. NVIDIA's free API has
// no quota to show, so this is the app's own count, not a limit.
import { count, eq, sql, sum } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const replyUsage = sqliteTable(
  "reply_usage",
  {
    seq: integer().primaryKey(),
    userId: text().notNull(),
    /** The model's key (src/lib/ai/models.ts). */
    model: text().notNull(),
    inputTokens: integer().notNull(),
    outputTokens: integer().notNull(),
    /** Milliseconds since 1970. */
    at: integer().notNull(),
  },
  (table) => [index("reply_usage_user_idx").on(table.userId, table.model)]
)

/** One model's totals. */
export type ModelUsage = { model: string; replies: number; tokens: number }

/** Adds a reply's use. */
export async function recordUsage(
  d1: D1Database,
  row: {
    userId: string
    model: string
    inputTokens: number
    outputTokens: number
  }
) {
  await drizzle(d1)
    .insert(replyUsage)
    .values({ ...row, at: Date.now() })
}

/** The user's replies and tokens, per model, all time. */
export async function usageByModel(
  d1: D1Database,
  userId: string
): Promise<ModelUsage[]> {
  const rows = await drizzle(d1)
    .select({
      model: replyUsage.model,
      replies: count(),
      tokens: sum(
        sql`${replyUsage.inputTokens} + ${replyUsage.outputTokens}`
      ).mapWith(Number),
    })
    .from(replyUsage)
    .where(eq(replyUsage.userId, userId))
    .groupBy(replyUsage.model)
  return rows
}
