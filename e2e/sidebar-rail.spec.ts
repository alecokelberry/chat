import type { Page } from "@playwright/test"

import { expect, showAllChats, signInAsDev, test } from "./session"

// The computer's sidebar collapsing to its rail (src/components/ui/
// sidebar.tsx, src/lib/sidebar.ts): from its toggle or ⌘B/Ctrl+B,
// remembered across a reload without showing the column first.

test.use({ viewport: { width: 1440, height: 900 } })

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })
const toggle = (page: Page) =>
  sidebar(page).getByRole("button", { name: "Sidebar" })
const width = async (page: Page) =>
  (await sidebar(page).boundingBox())?.width ?? 0

test("the toggle collapses the sidebar to a rail, and it stays after a reload", async ({
  page,
}) => {
  await signInAsDev(page)
  await showAllChats(page)
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true")
  const seeded = sidebar(page).getByRole("link", {
    name: "Seeded for an agent",
  })
  await expect(seeded).toBeVisible()

  await toggle(page).click()
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false")
  await expect.poll(() => width(page)).toBe(56)
  // The list hides; New Chat keeps its name and still works.
  await expect(seeded).toBeHidden()
  const newChat = sidebar(page).getByRole("link", { name: "New Chat" })
  await expect(newChat).toBeVisible()

  // The server renders the rail, so a reload never shows the column.
  const html = await (await page.request.get("/")).text()
  expect(html).toMatch(/<nav[^>]*data-collapsed/)
  await page.reload()
  expect(await width(page)).toBe(56)

  await toggle(page).click()
  await expect.poll(() => width(page)).toBe(254)
  await showAllChats(page)
  await expect(seeded).toBeVisible()
})

test("⌘B or Ctrl+B toggles it at once, even while typing", async ({ page }) => {
  await signInAsDev(page)
  // Keyboard actions never animate: data-instant lasts only two frames,
  // too short to catch by polling, so the page notes when it appears.
  await sidebar(page).evaluate((element) => {
    new MutationObserver(() => {
      if (element.hasAttribute("data-instant"))
        element.setAttribute("data-was-instant", "")
    }).observe(element, { attributeFilter: ["data-instant"] })
  })
  await page.getByRole("textbox", { name: "Message" }).click()
  await page.keyboard.press("ControlOrMeta+b")
  await expect(sidebar(page)).toHaveAttribute("data-collapsed")
  await expect(sidebar(page)).toHaveAttribute("data-was-instant")
  expect(await width(page)).toBe(56)
  await page.keyboard.press("ControlOrMeta+b")
  expect(await width(page)).toBe(254)
  await expect(toggle(page)).toHaveAttribute("aria-keyshortcuts", /B/)
})

// ui-sdk's agent test: the toggle is a control an agent can find and press.
test("an agent can collapse the sidebar", async ({ page }) => {
  await signInAsDev(page)
  const pressed = await page.evaluate(async () => {
    const result = await window.agent.act({
      steps: [{ ref: "Sidebar", action: "press", args: [] }],
    })
    return result.ok
  })
  expect(pressed).toBe(true)
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false")
})
