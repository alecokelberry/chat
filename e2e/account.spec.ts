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
// no flash on a reload (the status bar's color included), Sign out landing
// on /sign-in, and on a phone a sheet that opens at once and reaches the
// screen's bottom.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })
const accountRow = (page: Page) =>
  sidebar(page).getByRole("button", { name: "Dev", exact: true })
const menu = (page: Page) => page.getByRole("menu")

declare global {
  interface Window {
    nudges?: { open: boolean; taps: string }[]
  }
}

/** Notes each status bar nudge as it's added: whether it's in the top
 *  layer, and whether it lets taps through. */
async function recordNudges(page: Page) {
  await page.addInitScript(() => {
    window.nudges = []
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue
          if (node.dataset.slot !== "status-bar-nudge") continue
          requestAnimationFrame(() =>
            window.nudges?.push({
              open: node.matches(":popover-open"),
              taps: getComputedStyle(node).pointerEvents,
            })
          )
        }
    }).observe(document, { childList: true, subtree: true })
  })
}

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" })

  test("Theme flips light and dark and stays after a reload", async ({
    page,
  }) => {
    await signInAsDev(page)
    await accountRow(page).click()
    await expect(menu(page)).toContainText("Dev")
    await expect(menu(page)).toContainText("dev@chat.test")

    // iOS repaints the status bar from a theme-color that arrives, so
    // Theme swaps the tags for fresh ones rather than editing them.
    const firstTag = await page
      .locator('meta[name="theme-color"]')
      .first()
      .elementHandle()
    await menu(page).getByRole("menuitem", { name: "Theme" }).click()
    // It stays open, so the sun and moon can be seen trading places.
    await expect(menu(page)).toBeVisible()
    const html = page.locator("html")
    await expect(html).toHaveAttribute("data-color-scheme", "dark")
    // Both status bar colors point at the dark background.
    const statusBar = page.locator('meta[name="theme-color"]')
    await expect(statusBar.first()).toHaveAttribute("content", "#1e1d1d")
    await expect(statusBar.last()).toHaveAttribute("content", "#1e1d1d")
    expect(await firstTag.evaluate((tag) => tag.isConnected)).toBe(false)

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

  test("a saved theme colors the status bar before the app's scripts run", async ({
    page,
  }) => {
    // The phone is light; Dark is picked with the sign-in switch, so it's
    // saved the way ui-sdk saves it. After a reload with the app's own
    // scripts emptied, only the head's inline script can set the color.
    await page.goto("/sign-in")
    await page.getByRole("button", { name: "Dark theme" }).click()
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark"
    )
    await page.route("**/*.js", (route) =>
      route.fulfill({ contentType: "text/javascript", body: "" })
    )
    await page.reload()
    const statusBar = page.locator('meta[name="theme-color"]')
    await expect(statusBar).toHaveCount(2)
    await expect(statusBar.first()).toHaveAttribute("content", "#1e1d1d")
    await expect(statusBar.last()).toHaveAttribute("content", "#1e1d1d")
  })

  test("the sign-in switch flips the theme and keeps it after a reload", async ({
    page,
  }) => {
    await page.goto("/sign-in")
    await expect(page.locator("svg.lucide-message-circle")).toBeVisible()
    const html = page.locator("html")
    const toggle = page.getByRole("button", { name: "Dark theme" })
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await toggle.click()
    await expect(html).toHaveAttribute("data-color-scheme", "dark")
    // One label in both states; the pressed state says which.
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await page.reload()
    await expect(html).toHaveAttribute("data-color-scheme", "dark")
    await expect(
      page.getByRole("button", { name: "Dark theme" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  test("D switches the theme, but not while typing", async ({ page }) => {
    await signInAsDev(page)
    await expect(
      sidebar(page).locator("svg.lucide-message-circle")
    ).toBeVisible()
    const html = page.locator("html")
    await expect(html).toHaveAttribute("data-color-scheme", "system")
    await page.keyboard.press("d")
    await expect(html).toHaveAttribute("data-color-scheme", "dark")
    await page.keyboard.press("d")
    await expect(html).toHaveAttribute("data-color-scheme", "light")

    const message = page.getByRole("textbox", { name: "Message" })
    await message.click()
    await page.keyboard.type("dd")
    await expect(message).toHaveValue("dd")
    await expect(html).toHaveAttribute("data-color-scheme", "light")

    // Not under a dialog either: the account menu is open.
    await message.blur()
    await accountRow(page).click()
    await expect(menu(page)).toBeVisible()
    await page.keyboard.press("d")
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
    await recordNudges(page)
    await signInAsDev(page)
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    await expect(drawer.locator("svg.lucide-message-circle")).toBeVisible()
    await drawer.getByRole("button", { name: "Dev", exact: true }).tap()
    await expect(menu(page)).toContainText("dev@chat.test")
    await expect(menu(page)).toHaveAttribute("data-presentation", "sheet")
    await expectNoHeldStart(page)

    // A tapped Theme shows its press, then lets go like a native row: the
    // highlight ui-sdk keeps on the tapped row isn't painted after a touch.
    // Tapped where the row is once the sheet has slid up, as a finger would
    // (Playwright's own tap scrolls first, which the sheet reads as a swipe).
    const theme = menu(page).getByRole("menuitem", { name: "Theme" })
    await expect
      .poll(() =>
        menu(page).evaluate((el) =>
          el.style.getPropertyValue("--drawer-progress")
        )
      )
      .toBe("1")
    const box = await theme.boundingBox()
    if (box === null) throw new Error("Theme has no box")
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark"
    )
    await expect(theme).toHaveAttribute("data-highlighted")
    await expect(theme).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")

    // iOS repaints the status bar only when a layer appears, so the change
    // briefly shows an empty one in the top layer, then takes it away,
    // leaving the menu and the drawer open.
    await expect
      .poll(() => page.evaluate(() => window.nudges))
      .toContainEqual({ open: true, taps: "none" })
    await expect(page.locator('[data-slot="status-bar-nudge"]')).toHaveCount(0)
    await expect(menu(page)).toBeVisible()
    await expect(drawer).toBeVisible()

    // The sheet's fill carries on past its bottom edge, so it reaches the
    // screen's bottom even when iOS reports a viewport that ends short.
    await expect(menu(page)).toHaveCSS("box-shadow", /0px 96px 0px 0px$/)
  })
})
