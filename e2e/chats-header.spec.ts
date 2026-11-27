import type { Page } from "@playwright/test"

import {
  expect,
  greeting,
  hydrated,
  showAllChats,
  signInAsDev,
  tapInSheet,
  test,
} from "./session"

// The sidebar's Chats header (src/components/chat/chat-sidebar.tsx,
// SidebarSection in src/components/ui/sidebar.tsx), Grok's: its chevron folds the chats below Pinned,
// remembered in this browser; its … sorts them by last activity or date
// created, Pinned staying on top; its + starts a new chat; and a long list
// ends in Show more. The worst-case list (src/lib/dev/worst-case.ts) has
// 1,000 chats, started in the opposite order to their last activity.
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })

const chatsHeader = (page: Page) =>
  sidebar(page).getByRole("button", { name: "Chats", exact: true })

test("the Chats header folds the list, and it stays folded after a reload", async ({
  page,
}) => {
  await signInAsDev(page)
  await showAllChats(page)
  const older = sidebar(page).getByRole("region", { name: "Older" })
  await expect(older).toBeVisible()
  await expect(chatsHeader(page)).toHaveAttribute("aria-expanded", "true")
  await chatsHeader(page).click()
  await expect(older).toBeHidden()
  await expect(chatsHeader(page)).toHaveAttribute("aria-expanded", "false")
  // Pinned stays out of the fold.
  await expect(
    sidebar(page).getByRole("link", { name: "Seeded pinned" })
  ).toBeVisible()
  await page.reload()
  await expect(chatsHeader(page)).toHaveAttribute("aria-expanded", "false")
  await expect(older).toBeHidden()
  // And from the keyboard.
  await chatsHeader(page).focus()
  await page.keyboard.press("Enter")
  await showAllChats(page)
  await expect(older).toBeVisible()
})

test("the Chats … sorts by date created, keeping Pinned on top", async ({
  page,
}) => {
  await signInAsDev(page)
  await page.goto("/?data=worst")
  const firstUnpinned = sidebar(page)
    .getByRole("region", { name: "Chats" })
    .getByRole("listitem")
    .first()
    .getByRole("link")
  await expect(firstUnpinned).not.toHaveText("Worst-case chat 1000")
  await sidebar(page).getByRole("button", { name: "Chats options" }).click()
  const sort = page.getByRole("menu")
  await expect(
    sort.getByRole("menuitemradio", { name: "Last activity" })
  ).toBeChecked()
  await sort.getByRole("menuitemradio", { name: "Date created" }).click()
  await expect(firstUnpinned).toHaveText("Worst-case chat 1000")
  await expect(sidebar(page).getByRole("heading").first()).toHaveText("Pinned")
  await expect(
    sidebar(page).getByRole("region", { name: "Pinned" }).getByRole("listitem")
  ).toHaveCount(3)
  // Remembered in this browser.
  await page.reload()
  await expect(firstUnpinned).toHaveText("Worst-case chat 1000")
})

test("a long list ends in Show more, which shows the rest", async ({
  page,
}) => {
  await signInAsDev(page)
  await page.goto("/?data=worst")
  const chats = sidebar(page).getByRole("region", { name: "Chats" })
  await expect(chats.getByRole("listitem")).toHaveCount(30)
  await chats.getByRole("button", { name: "Show more" }).click()
  await expect(chats.getByRole("listitem")).toHaveCount(997)
  await expect(chats.getByRole("button", { name: "Show more" })).toHaveCount(0)
})

test("the Chats … sorts and Show more shows the rest from the keyboard", async ({
  page,
}) => {
  await signInAsDev(page)
  await page.goto("/?data=worst")
  await hydrated(page)
  const chats = sidebar(page).getByRole("region", { name: "Chats" })
  const firstUnpinned = chats.getByRole("listitem").first().getByRole("link")
  await expect(firstUnpinned).not.toHaveText("Worst-case chat 1000")
  await sidebar(page).getByRole("button", { name: "Chats options" }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("menu")).toBeVisible()
  // Typing a letter moves to the item it starts.
  await page.keyboard.type("D")
  await expect(
    page.getByRole("menuitemradio", { name: "Date created" })
  ).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(firstUnpinned).toHaveText("Worst-case chat 1000")

  // Show more goes once pressed, so focus moves to the first chat it shows.
  await chats.getByRole("button", { name: "Show more" }).focus()
  await page.keyboard.press("Enter")
  await expect(
    chats.getByRole("listitem").nth(30).getByRole("link")
  ).toBeFocused()
})

test("the Chats + starts a new chat, with ⌘J in its tooltip", async ({
  page,
}) => {
  await signInAsDev(page)
  await sidebar(page).getByRole("link", { name: "Seeded pinned" }).click()
  await expect(page).toHaveURL(/\/c\//)
  const plus = sidebar(page)
    .getByRole("region", { name: "Chats" })
    .getByRole("link", { name: "Start a chat" })
  await plus.hover()
  await expect(page.getByRole("tooltip")).toContainText("New Chat")
  await plus.click()
  await expect(page).toHaveURL(/\/$/)
  await expect(greeting(page)).toBeVisible()
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  // The header's fold and its … work by touch too, the … as a sheet.
  test("the Chats header folds and sorts in the drawer", async ({ page }) => {
    await signInAsDev(page)
    await page.goto("/?data=worst")
    await hydrated(page)
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    const chats = drawer.getByRole("region", { name: "Chats" })
    const firstUnpinned = chats.getByRole("listitem").first().getByRole("link")
    await expect(firstUnpinned).not.toHaveText("Worst-case chat 1000")

    await drawer.getByRole("button", { name: "Chats options" }).tap()
    const sheet = page.locator('[data-slot="menu-content"]')
    await expect(sheet).toHaveAttribute("data-presentation", "sheet")
    await tapInSheet(
      sheet,
      page.getByRole("menuitemradio", { name: "Date created" })
    )
    await expect(firstUnpinned).toHaveText("Worst-case chat 1000")
    // A pick closes the sheet: there's only one choice to make.
    await expect(sheet).toBeHidden()

    const header = drawer.getByRole("button", { name: "Chats", exact: true })
    await header.tap()
    await expect(header).toHaveAttribute("aria-expanded", "false")
    await expect(firstUnpinned).toBeHidden()
    await header.tap()
    await expect(firstUnpinned).toBeVisible()
  })
})
