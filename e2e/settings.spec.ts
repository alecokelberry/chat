import type { Page } from "@playwright/test"

import { expect, signInAsDev, tapInSheet, test } from "./session"

// Settings (src/components/chat/settings.tsx): the gear at the end of the
// account row and the menu's Settings both open it at Account; search
// filters its sections; Account shows who's signed in and signs out. On a
// phone the sections come first, and a tap slides to one, with Back.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })
const settings = (page: Page) => page.getByRole("dialog", { name: "Settings" })
const sections = (page: Page) =>
  settings(page).getByRole("tablist", { name: "Settings" })

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("the gear opens Settings at Account, with focus in search", async ({
    page,
  }) => {
    await signInAsDev(page)
    await sidebar(page).getByRole("button", { name: "Settings" }).click()
    await expect(settings(page)).toBeVisible()
    const search = settings(page).getByRole("searchbox", {
      name: "Search settings",
    })
    await expect(search).toBeFocused()
    await expect(
      sections(page).getByRole("tab", { name: "Account" })
    ).toHaveAttribute("aria-selected", "true")
    const account = settings(page).getByRole("tabpanel", { name: "Account" })
    await expect(account).toContainText("Dev")
    // Each test worker signs in as its own Dev (dev+N@chat.test).
    await expect(account).toContainText(/dev(\+\d+)?@chat\.test/)

    await page.keyboard.press("Escape")
    await expect(settings(page)).toBeHidden()
  })

  test("the menu's Settings opens it too", async ({ page }) => {
    await signInAsDev(page)
    await sidebar(page)
      .getByRole("button", { name: "Dev", exact: true })
      .click()
    await page.getByRole("menuitem", { name: "Settings" }).click()
    await expect(settings(page)).toBeVisible()
  })

  test("search keeps the sections that match, and says when none do", async ({
    page,
  }) => {
    await signInAsDev(page)
    await sidebar(page).getByRole("button", { name: "Settings" }).click()
    const search = settings(page).getByRole("searchbox", {
      name: "Search settings",
    })
    await search.fill("sign")
    await expect(sections(page).getByRole("tab")).toHaveText(["Account"])

    await search.fill("zanzibarite")
    await expect(sections(page).getByRole("tab")).toHaveCount(0)
    await expect(settings(page)).toContainText("No settings found")

    await settings(page).getByRole("button", { name: "Clear search" }).click()
    await expect(search).toHaveValue("")
    await expect(search).toBeFocused()
    await expect(sections(page).getByRole("tab")).toHaveText(["Account"])
  })

  test("Sign Out in Account signs out", async ({ page }) => {
    await signInAsDev(page)
    await sidebar(page).getByRole("button", { name: "Settings" }).click()
    await settings(page).getByRole("button", { name: "Sign Out" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test("the rail has no gear", async ({ page }) => {
    await signInAsDev(page)
    await sidebar(page).getByRole("button", { name: "Sidebar" }).click()
    await expect(sidebar(page)).toHaveAttribute("data-collapsed")
    await expect(
      sidebar(page).getByRole("button", { name: "Settings" })
    ).toBeHidden()
  })
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("the sections come first, then a tap slides to one and Back returns", async ({
    page,
  }) => {
    await signInAsDev(page)
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    await drawer.getByRole("button", { name: "Settings" }).tap()

    const sheet = settings(page)
    await expect(sheet).toBeVisible()
    const account = sections(page).getByRole("tab", { name: "Account" })
    await expect(account).toBeVisible()
    await expect(sheet.getByRole("button", { name: "Sign Out" })).toBeHidden()

    await tapInSheet(sheet, account)
    await expect(sheet.getByRole("button", { name: "Sign Out" })).toBeVisible()
    await expect(account).toBeHidden()

    await sheet.getByRole("button", { name: "Back to settings" }).tap()
    await expect(account).toBeVisible()
  })
})
