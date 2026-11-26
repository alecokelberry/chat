import type { Page } from "@playwright/test"

import {
  expect,
  expectNoHeldStart,
  recordStartTimes,
  signInAsDev,
  test,
} from "./session"

// The account row and its menu (src/components/chat/account-menu.tsx) and
// the theme it switches (src/components/ui/preferences.tsx): the name and
// email, Theme flipping light and dark with the status bar following and
// no flash on a reload, Sign out landing on /sign-in, and on a phone a
// sheet that opens at once.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })
const accountRow = (page: Page) =>
  sidebar(page).getByRole("button", { name: "Dev", exact: true })
const menu = (page: Page) => page.getByRole("menu")

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" })

  test("Theme flips light and dark and stays after a reload", async ({
    page,
  }) => {
    await signInAsDev(page)
    await accountRow(page).click()
    await expect(menu(page)).toContainText("Dev")
    await expect(menu(page)).toContainText("dev@chat.test")

    await menu(page).getByRole("menuitem", { name: "Theme" }).click()
    // It stays open, so the sun and moon can be seen trading places.
    await expect(menu(page)).toBeVisible()
    const html = page.locator("html")
    await expect(html).toHaveAttribute("data-color-scheme", "dark")
    // Both status bar colors point at the dark background.
    const statusBar = page.locator('meta[name="theme-color"]')
    await expect(statusBar.first()).toHaveAttribute("content", "#1e1d1d")
    await expect(statusBar.last()).toHaveAttribute("content", "#1e1d1d")

    // A reload paints dark from the start: the page's background is dark
    // before any of the app's scripts have run.
    await page.addInitScript(() => {
      addEventListener("DOMContentLoaded", () => {
        Object.assign(window, {
          firstScheme: document.documentElement.dataset.colorScheme,
        })
      })
    })
    await page.reload()
    await expect(html).toHaveAttribute("data-color-scheme", "dark")
    const firstScheme = await page.evaluate(() =>
      "firstScheme" in window ? window.firstScheme : undefined
    )
    expect(firstScheme).toBe("dark")
    const background = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    )
    expect(background).toBe("rgb(30, 29, 29)")

    await accountRow(page).click()
    await menu(page).getByRole("menuitem", { name: "Theme" }).click()
    await expect(html).toHaveAttribute("data-color-scheme", "light")
  })

  test("Sign out lands on /sign-in", async ({ page }) => {
    await signInAsDev(page)
    await accountRow(page).click()
    await menu(page).getByRole("menuitem", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await page.goto("/")
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test("in the rail the row is the avatar alone, still named", async ({
    page,
  }) => {
    await signInAsDev(page)
    await sidebar(page).getByRole("button", { name: "Sidebar" }).click()
    await expect
      .poll(async () => (await accountRow(page).boundingBox())?.width)
      .toBe(36)
    expect((await accountRow(page).boundingBox())?.height).toBe(36)
    await accountRow(page).click()
    await expect(menu(page)).toContainText("dev@chat.test")
  })

  // ui-sdk's agent test: the row is a control an agent can find and press,
  // and Sign out asks first.
  test("an agent can open the account menu", async ({ page }) => {
    await signInAsDev(page)
    const opened = await page.evaluate(async () => {
      const result = await window.agent.act({
        steps: [{ ref: "Dev", action: "press", args: [] }],
      })
      return result.ok
    })
    expect(opened).toBe(true)
    await expect(menu(page)).toBeVisible()
    await expect(
      menu(page).getByRole("menuitem", { name: "Sign out" })
    ).toHaveAttribute("data-agent-confirm", /signs you out/i)
  })
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("the drawer's account row opens the menu as a sheet", async ({
    page,
  }) => {
    await recordStartTimes(page)
    await signInAsDev(page)
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    await drawer.getByRole("button", { name: "Dev", exact: true }).tap()
    await expect(menu(page)).toContainText("dev@chat.test")
    await expect(menu(page)).toHaveAttribute("data-presentation", "sheet")
    await expectNoHeldStart(page)
  })
})
