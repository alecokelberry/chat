import { MOCK_PAGE_TITLE, READ_FAILED_REPLY, READ_REPLY } from "@/lib/ai/mock"
import { refusalFor, siteOf } from "@/lib/ai/web-address"

import { expect, replies, send, signInAsDev, test, unique } from "./session"

// Reading a page in a reply (src/lib/ai/read-page.ts, thread.tsx,
// sources.tsx), on the mock model: a message with "read <address>" makes
// it read that page, and mockRead answers after a second with a canned
// page that tries to give orders; "(read N)" asks for N reads
// (src/lib/ai/mock.ts). Nothing here reaches Keenable.

test("a pasted link is read, and listed as a source", async ({ page }) => {
  await signInAsDev(page)
  const dialogs: string[] = []
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message())
    void dialog.dismiss()
  })
  await send(page, unique("Please read https://example.org/article"))
  await expect(
    page.getByRole("button", { name: "Reading the page…" })
  ).toBeVisible()
  const step = page.getByRole("button", { name: "Read · 1 site" })
  await expect(step).toBeVisible()
  await expect(replies(page)).toHaveText(READ_REPLY)

  await step.click()
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(
    thread.getByText("Read https://example.org/article", { exact: true })
  ).toBeVisible()
  await expect(
    thread.getByText(`${MOCK_PAGE_TITLE} · example.org`)
  ).toBeVisible()
  // The page's own text, orders and markup, is never shown or run.
  await expect(thread.getByText(/pwned|leak\.invalid/)).toHaveCount(0)
  expect(dialogs).toEqual([])

  await page.getByRole("button", { name: "1 source" }).click()
  await expect(
    page.getByRole("menuitem", { name: `${MOCK_PAGE_TITLE}, example.org` })
  ).toHaveAttribute("href", "https://example.org/article")
})

test("a private address is refused before anything is read", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, unique("Please read http://localhost/admin"))
  const step = page.getByRole("button", { name: "Couldn't read the page" })
  await expect(step).toBeVisible()
  await expect(replies(page)).toHaveText(READ_FAILED_REPLY)
  await step.click()
  await expect(
    page.getByText(
      "That address is on a private or local network, so it can't be read."
    )
  ).toBeVisible()
  await expect(page.getByRole("button", { name: /sources?$/ })).toHaveCount(0)
})

test("a reply reads at most three pages", async ({ page }) => {
  await signInAsDev(page)
  await send(page, unique("Please read https://example.org/a (read 5)"))
  await expect(replies(page)).toHaveText(READ_REPLY, { timeout: 15_000 })
  await page.getByRole("button", { name: "Read · 1 site" }).click()
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(
    thread.getByText("Read https://example.org/a", { exact: true })
  ).toHaveCount(3)
})

test("only public web addresses can be read", () => {
  for (const url of [
    "https://example.org/a",
    "http://news.example.com:8080/x?y=1",
    "https://8.8.8.8/",
  ])
    expect(refusalFor(url), url).toBeNull()
  for (const url of [
    "not a link",
    "ftp://example.org/",
    "javascript:alert(1)",
    "https://user:pass@example.org/",
    "http://localhost:8787/",
    "http://printer/",
    "http://nas.local/",
    "http://db.internal/",
    "http://127.0.0.1/",
    "http://10.1.2.3/",
    "http://172.20.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://100.100.1.1/",
    "http://0.0.0.0/",
    "http://[::1]/",
    `https://example.org/${"a".repeat(2048)}`,
  ])
    expect(refusalFor(url), url).not.toBeNull()
  expect(siteOf("https://www.example.org/a")).toBe("example.org")
  expect(siteOf("mailto:a@example.org")).toBeNull()
})
