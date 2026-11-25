import { defineConfig, devices } from "@playwright/test"

// Smoke tests against a production build served by Wrangler's local
// runtime (workerd), the same runtime as live, on a fresh local D1. On
// localhost, not 127.0.0.1: passkeys need a host name. The Worker's
// secrets come from this environment, so no .dev.vars is needed.
const PORT = 3400
export const E2E_SETUP_CODE = "e2e-setup-code"
const ci = (process.env.CI ?? "") !== ""

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `rm -rf .wrangler/state && wrangler d1 migrations apply chat --local && vite preview --host localhost --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: false,
    env: {
      CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
      BETTER_AUTH_SECRET: "e2e-only-secret-at-least-32-characters",
      SETUP_CODE: E2E_SETUP_CODE,
      DEV_SIGN_IN: "1",
    },
  },
})
