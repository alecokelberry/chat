import type { Page } from "@playwright/test"

import { expect, send, signInAsDev, signInAsOwner, test } from "./session"

// The chat list (src/components/chat/chat-sidebar.tsx, src/lib/chat) on the
// mock model: a send puts its chat at the top, the first reply names it
// (the mock always says TITLE, src/lib/ai/mock.ts), rows are grouped by
// the browser's own day, and on a phone the list is a drawer. Other tests
// make chats as Dev at the same time, so these check their own rows, not
// the whole list. Rows named "Seeded …" come from e2e/seed.sql.

const TITLE = "Talking to the mock model"

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })

test.describe.configure({ mode: "serial" })

test("a new chat shows at the top as New chat, then takes its title", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Name me")
  const open = sidebar(page).locator("a[aria-current=page]")
  // While the reply streams, the chat is listed but not yet named.
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(open).toHaveText("New chat")
  await expect(
    sidebar(page).getByRole("region", { name: "Today" })
  ).toContainText("New chat")

  await expect(open).toHaveText(TITLE)
  await page.reload()
  await expect(open).toHaveText(TITLE)
})

test("a chat moves up when it gets a message", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "First of two")
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  const first = page.url()
  await sidebar(page)
    .getByRole("link", { name: "New Chat", exact: true })
    .click()
  await expect(page.getByRole("heading", { name: "Hi, Dev" })).toBeVisible()
  await send(page, "Second of two")
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  const second = page.url()
  const order = async () => {
    const hrefs = await sidebar(page)
      .getByRole("listitem")
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
    const path = (url: string) => new URL(url).pathname
    return [hrefs.indexOf(path(first)), hrefs.indexOf(path(second))]
  }
  await expect.poll(order).toEqual([expect.any(Number), expect.any(Number)])
  const [a, b] = await order()
  expect(b).toBeLessThan(a ?? -1)

  // Opening the first and sending moves it back above the second.
  await page.goto(first)
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  await send(page, "Back to the first")
  await expect
    .poll(async () => {
      const [x = -1, y = -1] = await order()
      return x < y
    })
    .toBe(true)
})

test.describe("in Auckland", () => {
  test.use({ timezoneId: "Pacific/Auckland" })

  test("groups follow the browser's own day", async ({ page }) => {
    // Mar 10, 10:00 in Auckland (UTC+13), still Mar 9 in UTC; one seeded
    // chat is from 23:30 the night before there, still Mar 9 in UTC.
    const now = Date.UTC(2026, 2, 9, 21, 0)
    await page.clock.setFixedTime(now)
    await signInAsDev(page)
    const group = (name: string) =>
      sidebar(page).getByRole("region", { name, exact: true })
    await expect(group("Today")).toContainText("Seeded just after midnight")
    await expect(group("Yesterday")).toContainText("Seeded late last night")
    await expect(group("Previous 7 days")).toContainText(
      "Seeded three days ago"
    )
    await expect(group("Older")).toContainText("Seeded a month ago")
    const headings = await sidebar(page).getByRole("heading").allInnerTexts()
    expect(headings).toEqual(["Today", "Yesterday", "Previous 7 days", "Older"])
  })
})

test("holds up with 1,000 chats and worst-case titles", async ({ page }) => {
  const long =
    "An unreasonably long chat title that goes on and on and on and on and on and on and on and on"
  await page.setViewportSize({ width: 1440, height: 900 })
  await signInAsOwner(page)
  const rows = sidebar(page).getByRole("listitem")
  await expect(rows.filter({ hasText: "Seeded chat 996" })).toHaveCount(1)
  expect(await rows.count()).toBeGreaterThanOrEqual(1000)

  // Long titles stay on one 40px row inside the column.
  const row = sidebar(page).getByRole("link", { name: long })
  const box = await row.boundingBox()
  const column = await sidebar(page).boundingBox()
  expect(box?.height).toBe(40)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    (column?.x ?? 0) + (column?.width ?? 0)
  )
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
  expect(wide).toBe(false)

  // The last row is reachable, and opening it works.
  const last = sidebar(page).getByRole("link", { name: "Seeded chat 996" })
  await last.scrollIntoViewIfNeeded()
  await last.click()
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/)
  await expect(last).toHaveAttribute("aria-current", "page")
})

// ui-sdk's agent test: rows are controls an agent can find and press.
test("an agent can open a chat from the list", async ({ page }) => {
  await signInAsDev(page)
  await expect(
    sidebar(page).getByRole("link", { name: "Seeded for an agent" })
  ).toBeVisible()
  const result = await page.evaluate(async () => {
    const { agent } = window
    const labels = agent
      .snapshot()
      .filter((entry) => entry.offPage !== true && entry.ref !== "more")
      .map((entry) => entry.label)
    const opened = await agent.act({
      steps: [{ ref: "Seeded for an agent", action: "press", args: [] }],
    })
    return { labels, opened: opened.ok }
  })
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.labels).toEqual(expect.arrayContaining(["New Chat"]))
  expect(result.opened).toBe(true)
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/)
  await expect(
    sidebar(page).getByRole("link", { name: "Seeded for an agent" })
  ).toHaveAttribute("aria-current", "page")
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("the list is a drawer from the start edge", async ({ page }) => {
    await signInAsDev(page)
    await send(page, "From my phone")
    await expect(page.getByRole("article", { name: "Reply" })).toContainText(
      "Done."
    )
    await expect(sidebar(page)).toBeHidden()

    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    await expect(drawer).toBeVisible()
    // It slides in from the start edge and rests against it.
    await expect.poll(async () => (await drawer.boundingBox())?.x).toBe(0)
    await expect(drawer.locator("a[aria-current=page]")).toHaveText(TITLE)

    // Picking New Chat goes there and closes the drawer.
    await drawer.getByRole("link", { name: "New Chat", exact: true }).tap()
    await expect(page).toHaveURL(/\/$/)
    await expect(drawer).toBeHidden()
  })

  // ui-sdk's agent test: the drawer's trigger is named and an agent can
  // open it.
  test("an agent can open the drawer", async ({ page }) => {
    await signInAsDev(page)
    const result = await page.evaluate(async () => {
      const { agent } = window
      const labels = agent
        .snapshot()
        .filter((entry) => entry.offPage !== true && entry.ref !== "more")
        .map((entry) => entry.label)
      const opened = await agent.act({
        steps: [{ ref: "Open sidebar", action: "press", args: [] }],
      })
      return { labels, opened: opened.ok }
    })
    expect(result.labels.every(Boolean)).toBe(true)
    expect(result.labels).toEqual(expect.arrayContaining(["Open sidebar"]))
    expect(result.opened).toBe(true)
    await expect(page.getByRole("dialog", { name: "Chats" })).toBeVisible()
  })
})
