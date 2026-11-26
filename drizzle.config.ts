// drizzle-kit: `pnpm db:generate` writes a migration into migrations/ from
// the Drizzle tables (src/lib/chat/store.ts); `pnpm run deploy` applies it
// with Wrangler, as before. Only exported tables are generated, so Better
// Auth's own (migrations/0001_auth.sql) stay its own. New files get a
// timestamp, so they sort after 0001 and 0002 (the first generated one,
// renamed to keep the name Previews already applied).
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/chat/store.ts",
  out: "./migrations",
  migrations: { prefix: "timestamp" },
})
