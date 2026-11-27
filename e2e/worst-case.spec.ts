import type { Page } from "@playwright/test"

import { expect, questions, replies, signInAsDev, test } from "./session"

// ?data=worst, empty and one (src/lib/dev/worst-case.ts, in dev and this
// test build, never live): the sidebar's chats and account, and a chat's
// messages, swap for made-up extremes at the layout's and chat's data, a bar
// at the bottom flips between them, ✕ goes back to the real data, and the
// parameter stays on while navigating. At 390 nothing may push the page
// wider than the screen.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })
const bar = (page: Page) =>
  page.getByRole("radiogroup", { name: "Preview data" })
const SEEDED_CHAT = "00000000-0000-4000-8000-000000000000"

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("each state swaps the sidebar, and ✕ returns the real data", async ({
    page,
  }) => {
    await signInAsDev(page)
    await expect(sidebar(page)).toContainText("Seeded pinned")

    await page.goto("/?data=worst")
    await expect(bar(page)).toBeVisible()
    await expect(sidebar(page)).toContainText("Supercalifragilistic")
    await expect(sidebar(page)).toContainText("Aleksandra")
    await expect(sidebar(page)).not.toContainText("Seeded pinned")
    await expect(
      sidebar(page).getByRole("region", { name: "Pinned" })
    ).toBeVisible()

    await bar(page).getByRole("radio", { name: "Empty" }).click()
    await expect(page).toHaveURL(/data=empty/)
    await expect(
      sidebar(page).getByRole("link", { name: "Worst-case" })
    ).toHaveCount(0)
    await expect(sidebar(page)).not.toContainText("Supercalifragilistic")

    await bar(page).getByRole("radio", { name: "One" }).click()
    await expect(sidebar(page)).toContainText("The only chat")
    await expect(
      sidebar(page).getByRole("button", { name: "J", exact: true })
    ).toBeVisible()

    await page.getByRole("button", { name: "Back to the real data" }).click()
    await expect(bar(page)).toHaveCount(0)
    await expect(page).not.toHaveURL(/data=/)
    await expect(sidebar(page)).toContainText("Seeded pinned")
  })

  test("stays on while moving between pages, and swaps a chat's messages", async ({
    page,
  }) => {
    await signInAsDev(page)
    await page.goto("/?data=worst")
    await expect(bar(page)).toBeVisible()
    await sidebar(page)
      .getByRole("link", { name: /Supercalifragilistic/ })
      .click()
    await expect(page).toHaveURL(/\/c\/.*data=worst/)
    await expect(bar(page)).toBeVisible()
    await expect(questions(page)).toHaveCount(2)
    await expect(replies(page).first()).toContainText("A very long reply")

    await bar(page).getByRole("radio", { name: "Empty" }).click()
    await expect(questions(page)).toHaveCount(0)
    await bar(page).getByRole("radio", { name: "One" }).click()
    await expect(replies(page)).toContainText("Hello!")
  })
})

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test("worst-case data doesn't widen the page", async ({ page }) => {
    await signInAsDev(page)
    await page.goto(`/c/${SEEDED_CHAT}?data=worst`)
    await expect(replies(page).first()).toContainText("A very long reply")
    // The wide table and long code line scroll inside their own boxes.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
