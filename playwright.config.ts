import { defineConfig, devices } from "@playwright/test"

// Smoke tests against a production build served by Wrangler's local
// runtime (workerd), the same runtime as live, on a fresh local D1. On
// localhost, not 127.0.0.1: passkeys need a host name. It serves the last
// `vite build --mode test` (`pnpm e2e` runs it): test mode only adds ui-sdk's
// agent bridge (window.agent). The Worker's secrets and vars come from this
// environment: the build copies secrets it finds into dist/server/.dev.vars,
// and preview would then ignore the environment, so that file goes first.
//
// Chats run on the mock model. `pnpm smoke` runs the tests tagged @nvidia
// on the real Super through the AI Gateway instead, by hand before a deploy:
// it needs NVIDIA_API_KEY, AI_GATEWAY_URL and AI_GATEWAY_TOKEN exported in
// the shell (README.md).
const PORT = 3400
export const BASE_URL = `http://localhost:${PORT}`
export const E2E_SETUP_CODE = "e2e-setup-code"
const ci = (process.env.CI ?? "") !== ""
const smoke = process.env.NVIDIA_SMOKE === "1"

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: ci,
  // Each worker signs in as its own Dev (e2e/session.ts), so any test can
  // run beside any other, and shards split by test, not by file.
  fullyParallel: true,
  // In CI a failed test runs once more to record a trace, and a test that
  // passes only on that retry still fails the run: a flake gets fixed,
  // not hidden. The github reporter puts failures on the PR's lines. CI
  // runs the tests in shards (.github/workflows/verify.yml): each writes a
  // blob report, and the report job merges them into one HTML report.
  retries: ci ? 1 : 0,
  failOnFlakyTests: ci,
  reporter: ci ? [["github"], ["list"], ["blob"]] : "list",
  // Ends a stuck run in time to write its report, inside the CI job's
  // 15 minutes (Playwright's CI docs: always set one).
  globalTimeout: ci ? 12 * 60_000 : 0,
  use: { baseURL: BASE_URL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(smoke ? { grep: /@nvidia/ } : { grepInvert: /@nvidia/ }),
  webServer: {
    command: `rm -rf .wrangler/state dist/server/.dev.vars && wrangler d1 migrations apply chat --local && wrangler d1 execute chat --local --file e2e/seed.sql && vite preview --host localhost --port ${PORT} --strictPort`,
    url: `${BASE_URL}/sign-in`,
    reuseExistingServer: false,
    env: {
      CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
      BETTER_AUTH_SECRET: "e2e-only-secret-at-least-32-characters",
      SETUP_CODE: E2E_SETUP_CODE,
      DEV_SIGN_IN: "1",
      PASSKEY_RP_ID: "localhost",
      MOCK_MODEL: smoke ? "0" : "1",
      ...(smoke
        ? {}
        : {
            NVIDIA_API_KEY: "unused-by-the-mock",
            AI_GATEWAY_URL: "https://gateway.invalid",
            AI_GATEWAY_TOKEN: "unused-by-the-mock",
            KEENABLE_API_KEY: "unused-by-the-mock",
          }),
    },
  },
})
