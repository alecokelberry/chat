import type { Page } from "@playwright/test"

import { TOUR_ID, TOUR_MESSAGES, TOUR_TITLE } from "@/lib/chat/tour"

import {
  expect,
  questions,
  replies,
  send,
  sidebar,
  signInAsDev,
  test,
} from "./session"

// The feature tour (src/lib/chat/tour.ts): Feature tour in the account menu
// adds the pinned demo chat and opens it, rendered like any chat (thinking,
// web search, a folded code block, a table, math). Pressing it again
// refreshes the same chat, dropping what was asked since, and never adds a
// second. It deletes like any chat.

const PATH = `/c/${TOUR_ID}`
const QUESTIONS = TOUR_MESSAGES.filter((m) => m.role === "user").length

const menu = (page: Page) => page.getByRole("menu")
const tourRows = (page: Page) => sidebar(page).locator(`a[href="${PATH}"]`)

async function openTour(page: Page) {
  await sidebar(page).getByRole("button", { name: "Dev", exact: true }).click()
  await menu(page).getByRole("menuitem", { name: "Feature tour" }).click()
  await expect(page).toHaveURL(new RegExp(`${PATH}$`))
  await expect(questions(page)).toHaveCount(QUESTIONS)
}

test.use({ viewport: { width: 1440, height: 900 } })

test("Feature tour adds one pinned demo chat, refreshes it, and deletes", async ({
  page,
}) => {
  await signInAsDev(page)
  await openTour(page)

  const pinned = sidebar(page).getByRole("region", { name: "Pinned" })
  await expect(pinned.getByRole("link", { name: TOUR_TITLE })).toBeVisible()
  await expect(replies(page)).toHaveCount(QUESTIONS)
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(
    thread.getByRole("button", { name: "Thought for 6s" })
  ).toBeVisible()
  await expect(
    thread.getByRole("button", { name: "Searched · 2 sites" })
  ).toBeVisible()
  await expect(thread.getByRole("button", { name: "2 sources" })).toBeVisible()
  await expect(thread.getByRole("button", { name: "Show more" })).toBeVisible()
  await expect(thread.locator("table")).toHaveCount(1)
  await expect(thread.locator(".katex-display")).toHaveCount(2)
  await expect(thread.getByText("Super · 4.3s")).toBeVisible()

  // Asked on, it's a chat like any other; the tour again puts it back.
  await send(page, "One more question")
  await expect(questions(page)).toHaveCount(QUESTIONS + 1)
  await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0)
  await openTour(page)
  await expect(replies(page)).toHaveCount(QUESTIONS)
  await page.reload()
  await expect(questions(page)).toHaveCount(QUESTIONS)
  await expect(tourRows(page)).toHaveCount(1)

  await page.getByRole("button", { name: "Chat actions" }).click()
  await menu(page).getByRole("menuitem", { name: "Delete" }).click()
  await expect(tourRows(page)).toHaveCount(0)
  await page.evaluate(() => window.toast.dismiss())
  await page.reload()
  await expect(tourRows(page)).toHaveCount(0)
})
