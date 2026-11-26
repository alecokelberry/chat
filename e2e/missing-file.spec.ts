import { expect, test } from "./session"

// A file that isn't there (an old build's chunk, a browser's favicon guess)
// gets a bare 404 from src/server.ts, not a rendered page.

for (const path of ["/assets/index-old.js", "/favicon.ico"]) {
  test(`${path} is a bare 404`, async ({ request }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(404)
    expect(await response.text()).toBe("")
  })
}
