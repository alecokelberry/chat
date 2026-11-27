import { defineConfig } from "vitest/config"

// A time zone with daylight saving, so date logic meets 23- and 25-hour
// days. Set here, before Vitest starts its workers, which inherit it.
process.env.TZ = "America/New_York"

// Unit tests (`pnpm test`): Vitest in Node, for pure logic only, with
// fast-check properties (@fast-check/vitest's `test.prop`). Kept apart from
// vite.config.ts so a run loads none of the app's plugins (Cloudflare,
// TanStack Start), which keeps it well under a second. Anything that needs
// the Worker, D1 or a browser is tested end to end in e2e/ instead.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
