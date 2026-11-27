import type { Page } from "@playwright/test"

import { expect, signInAsDev, tapInSheet, test } from "./session"

// Search (src/components/chat/search.tsx, search-chats.tsx): ⌘K or a search icon opens it,
// a dialog on a computer and a sheet on a phone. With nothing typed it
// lists the chats grouped like the sidebar; typing narrows them by title,
// fuzzily, with the matched letters in bold, and Enter or a click opens
// one. Dev's chats come from e2e/seed.sql ("Seeded …"); other tests add
// chats as Dev at the same time, so these look for their own rows. With
// 1,000 chats: e2e/sidebar.spec.ts.

const dialog = (page: Page) => page.getByRole("dialog", { name: "Search" })
const field = (page: Page) =>
  page.getByRole("combobox", { name: "Search chats" })

test("⌘K opens Search, typing narrows by title, and Enter opens the chat", async ({
  page,
}) => {
  await signInAsDev(page)
  await page.keyboard.press("ControlOrMeta+k")
  await expect(field(page)).toBeFocused()
  await expect(field(page)).toHaveValue("")
  // Nothing typed: the chats, in the sidebar's groups.
  await expect(
    dialog(page).getByRole("group", { name: "Pinned" })
  ).toContainText("Seeded pinned")

  // Fuzzy: the letters in order, across words.
  await field(page).fill("sdkpt")
  const kept = dialog(page).getByRole("option", { name: "Seeded kept title" })
  await expect(kept).toBeVisible()
  await expect(kept.locator("strong").first()).toHaveText("S")
  await expect(dialog(page).getByRole("option")).toHaveCount(1)

  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000006$/)
  await expect(dialog(page)).toHaveCount(0)
})

test("⌘K again or Escape closes it, even with text typed", async ({ page }) => {
  await signInAsDev(page)
  await page.keyboard.press("ControlOrMeta+k")
  await field(page).fill("seeded")
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)

  // Each open starts empty.
  await page.keyboard.press("ControlOrMeta+k")
  await expect(field(page)).toHaveValue("")
  await page.keyboard.press("ControlOrMeta+k")
  await expect(dialog(page)).toHaveCount(0)
})

test("the search icon opens it, and a click on a chat goes there", async ({
  page,
}) => {
  await signInAsDev(page)
  const button = page
    .getByRole("navigation", { name: "Chats" })
    .getByRole("button", { name: "Search" })
  await button.click()
  await field(page).fill("seeded pinned")
  await dialog(page).getByRole("option", { name: "Seeded pinned" }).click()
  await expect(page).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000005$/)
  await expect(dialog(page)).toHaveCount(0)
})

test("no match says so", async ({ page }) => {
  await signInAsDev(page)
  await page.keyboard.press("ControlOrMeta+k")
  await field(page).fill("zzqxv")
  await expect(dialog(page)).toContainText("No chats match “zzqxv”")
  await expect(dialog(page).getByRole("option")).toHaveCount(0)
})

test.describe("on a touch phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test("the header's icon opens a sheet, and so does the drawer's", async ({
    page,
  }) => {
    await signInAsDev(page)
    await page.getByRole("button", { name: "Search" }).tap()
    await expect(page.locator('[data-slot="dialog-content"]')).toHaveAttribute(
      "data-presentation",
      "sheet"
    )
    await tapInSheet(page.locator('[data-slot="dialog-content"]'), field(page))
    await field(page).fill("seeded kept")
    await dialog(page).getByRole("option", { name: "Seeded kept title" }).tap()
    await expect(page).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000006$/)

    await page.getByRole("button", { name: "Open sidebar" }).tap()
    await page
      .getByRole("dialog", { name: "Chats" })
      .getByRole("button", { name: "Search" })
      .tap()
    await expect(dialog(page)).toBeVisible()
    await expect(page.getByRole("dialog", { name: "Chats" })).toHaveCount(0)
  })
})

// ui-sdk's agent bridge (window.agent, test builds): an agent finds the
// search icon by name, opens Search, searches and runs a chat, which
// opens it.
test("an agent can search and open a chat", async ({ page }) => {
  await signInAsDev(page)
  const result = await page.evaluate(async () => {
    const { agent } = window
    const find = (label: string) =>
      agent
        .snapshot()
        .find((entry) => entry.label === label && entry.offPage !== true)
    const opened = await agent.act({
      steps: [{ ref: find("Search")?.ref ?? "", action: "press", args: [] }],
    })
    // The list's code loads as Search opens.
    for (
      let tries = 0;
      find("Search chats") === undefined && tries < 50;
      tries++
    )
      await new Promise((resolve) => setTimeout(resolve, 100))
    const search = find("Search chats")?.ref ?? ""
    const searched = await agent.act({
      steps: [
        { ref: search, action: "setQuery", args: ["kept title"] },
        { ref: search, action: "run", args: [] },
      ],
    })
    return {
      opened: opened.ok,
      searched: searched.ok,
      error: searched.error?.message,
    }
  })
  expect(result.opened).toBe(true)
  expect(result.searched, result.error).toBe(true)
  await expect(page).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000006$/)
  await expect(dialog(page)).toHaveCount(0)
})
