import { gzipSync } from "node:zlib"

import type { Page, Response } from "@playwright/test"

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
  "a new chat": 300,
  "a saved chat": 720,
}

test.use({ viewport: { width: 390, height: 844 } })

/** Opens `url` in a fresh browser context (a cold cache) that keeps the
 *  signed-in cookies of `signedIn`, and returns the gzipped bytes of every
 *  script it fetched. */
async function firstLoadBytes(signedIn: Page, url: string) {
  const state = await signedIn.context().storageState()
  const context = await signedIn
    .context()
    .browser()
    ?.newContext({
      storageState: state,
      viewport: { width: 390, height: 844 },
      baseURL: String(test.info().project.use.baseURL),
    })
  if (context === undefined) throw new Error("No browser")
  const page = await context.newPage()
  const sizes: Promise<number>[] = []
  const count = (response: Response) => {
    if (response.request().resourceType() !== "script") return
    if (response.status() >= 300 && response.status() < 400) return
    sizes.push(
      response.body().then((body) => gzipSync(body, { level: 6 }).length)
    )
  }
  page.on("response", count)
  await page.goto(url)
  await page.waitForLoadState("networkidle")
  await context.close()
  const total = (await Promise.all(sizes)).reduce((a, b) => a + b, 0)
  if (process.env.BUNDLE_REPORT !== undefined)
    console.log(`${url}: ${total / KB} KB gzipped`)
  return total
}

test("sign-in stays within its first-load budget", async ({ page }) => {
  expect(await firstLoadBytes(page, "/sign-in")).toBeLessThan(
    budgets["sign-in"] * KB
  )
})

test("a new chat and a saved chat stay within their first-load budgets", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Size check")
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  const saved = page.url()
  expect(await firstLoadBytes(page, "/")).toBeLessThan(
    budgets["a new chat"] * KB
  )
  expect(await firstLoadBytes(page, saved)).toBeLessThan(
    budgets["a saved chat"] * KB
  )
})
