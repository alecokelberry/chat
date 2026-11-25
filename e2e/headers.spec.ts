import { expect, test } from "@playwright/test"

import { SECURITY_HEADERS } from "../src/start"

// The security headers from src/start.ts, on a page and on /api.

for (const path of ["/sign-in", "/api/auth/ok"]) {
  test(`${path} carries the security headers`, async ({ request }) => {
    const headers = (await request.get(path)).headers()
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(headers[name.toLowerCase()]).toBe(value)
    }
  })
}
