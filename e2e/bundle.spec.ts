import { gzipSync } from "node:zlib"

import type { Browser, Page, Response } from "@playwright/test"

import { expect, send, signInAsDev, test } from "./session"

// A size budget for each page's first load: the JavaScript a cold phone
// (390 wide) downloads, gzipped, summed over every script the page fetches
// until the network goes quiet. The server's own compression doesn't
// matter: each script's body is gzipped here, so the number is the same on
// any machine. Each budget sits just above today's size, so a heavy import
// (all of Shiki loaded eagerly, say) fails here. Raising one is a choice:
// put the reason in the commit. Run with BUNDLE_REPORT=1 to print sizes.

const KB = 1024

// Today's sizes, rounded up by about 5%.
const budgets = {
  "sign-in": 240,
  "a new chat": 315,
  "a saved chat": 720,
}

const viewport = { width: 390, height: 844 }

test.use({ viewport })

/** Opens `url` in a fresh browser context (a cold cache) that keeps the
 *  signed-in cookies of `signedIn`, and returns the gzipped bytes of every
 *  script it fetched. */
async function firstLoadBytes(
  browser: Browser,
  baseURL: string | undefined,
  signedIn: Page,
  url: string
) {
  const context = await browser.newContext({
    storageState: await signedIn.context().storageState(),
    viewport,
    baseURL,
  })
  try {
    const page = await context.newPage()
    const sizes: Promise<number>[] = []
    page.on("response", (response: Response) => {
      if (response.request().resourceType() !== "script") return
      if (response.status() >= 300 && response.status() < 400) return
      sizes.push(
        response.body().then((body) => gzipSync(body, { level: 6 }).length)
      )
    })
    await page.goto(url)
    await page.waitForLoadState("networkidle")
    // Read every body before the context closes, or a pending one fails.
    const total = (await Promise.all(sizes)).reduce((a, b) => a + b, 0)
    if (process.env.BUNDLE_REPORT !== undefined)
      console.log(`${url}: ${total / KB} KB gzipped`)
    return total
  } finally {
    await context.close()
  }
}

test("sign-in stays within its first-load budget", async ({
  page,
  browser,
  baseURL,
}) => {
  expect(await firstLoadBytes(browser, baseURL, page, "/sign-in")).toBeLessThan(
    budgets["sign-in"] * KB
  )
})

test("a new chat and a saved chat stay within their first-load budgets", async ({
  page,
  browser,
  baseURL,
}) => {
  await signInAsDev(page)
  await send(page, "Size check")
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  const saved = page.url()
  expect(await firstLoadBytes(browser, baseURL, page, "/")).toBeLessThan(
    budgets["a new chat"] * KB
  )
  expect(await firstLoadBytes(browser, baseURL, page, saved)).toBeLessThan(
    budgets["a saved chat"] * KB
  )
})
