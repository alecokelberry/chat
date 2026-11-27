import type { Page } from "@playwright/test"

import {
  expect,
  expectNoHeldStart,
  recordStartTimes,
  signInAsDev,
  test,
} from "./session"
import { statusBar, watchStatusBar } from "./status-bar"

// The account row and its menu (src/components/chat/account-menu.tsx) and
// the theme it switches (src/components/ui/preferences.tsx): the name and
// email, Theme flipping light and dark with the status bar following and
// no flash on a reload (the status bar's color included), Sign out landing
// on /sign-in, and on a phone a sheet that opens at once, with iOS's status
// bar (as e2e/status-bar.ts models it) following a Theme picked inside the
// drawer.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })
const accountRow = (page: Page) =>
  sidebar(page).getByRole("button", { name: "Dev", exact: true })
const menu = (page: Page) => page.getByRole("menu")
const LIGHT = "rgb(249, 248, 247)"
const DARK = "rgb(30, 29, 29)"
const LIGHT_HEX = "#f9f8f7"
const DARK_HEX = "#1e1d1d"

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" })

  test("Theme flips light and dark and stays after a reload", async ({
    page,
  }) => {
    await signInAsDev(page)
    await accountRow(page).click()
    await expect(menu(page)).toContainText("Dev")
    await expect(menu(page)).toContainText("dev@chat.test")

    // Theme swaps the tags for fresh ones rather than editing them, which
    // the drawer would undo when it closes.
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

  test("the server writes the saved theme's status bar color", async ({
    browser,
  }) => {
    // An iPhone's Home Screen app reads theme-color once, as the page
    // loads, so it has to be right in the HTML: here with no scripts at
    // all, the phone light and Dark saved.
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      colorScheme: "light",
      javaScriptEnabled: false,
    })
    const page = await context.newPage()
    await page.goto("/sign-in")
    const statusBar = page.locator('meta[name="theme-color"]')
    await expect(statusBar.first()).toHaveAttribute("content", "#f9f8f7")
    await expect(statusBar.last()).toHaveAttribute("content", "#1e1d1d")
    await context.addCookies([
      { name: "theme", value: "dark", url: page.url() },
    ])
    await page.reload()
    await expect(statusBar).toHaveCount(2)
    await expect(statusBar.first()).toHaveAttribute("content", "#1e1d1d")
    await expect(statusBar.last()).toHaveAttribute("content", "#1e1d1d")
    await context.close()
  })

  test("picking a theme saves it in the cookie the server reads", async ({
    page,
    context,
  }) => {
    await page.goto("/sign-in")
    await page.getByRole("button", { name: "Dark theme" }).click()
    await expect
      .poll(async () =>
        (await context.cookies()).find((c) => c.name === "theme")
      )
      .toMatchObject({ value: "dark" })
  })

  test("in the Home Screen app, a theme change reloads the page", async ({
    page,
  }) => {
    // Its status bar is drawn from the color the page loaded with.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true })
    })
    await page.goto("/sign-in")
    await expect(page.getByRole("button", { name: "Dark theme" })).toBeVisible()
    const loads: string[] = []
    page.on("load", () => loads.push(page.url()))
    await page.getByRole("button", { name: "Dark theme" }).click()
    await expect.poll(() => loads.length).toBe(1)
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark"
    )
    const statusBar = page.locator('meta[name="theme-color"]')
    await expect(statusBar.first()).toHaveAttribute("content", "#1e1d1d")
    // Once, not again and again: the reloaded page leaves it be.
    await page.waitForTimeout(1000)
    expect(loads).toHaveLength(1)

    // Under System, the phone switching to dark doesn't reload: the next
    // launch picks it up, and a draft or a streaming reply isn't lost.
    await page.evaluate(() => localStorage.setItem("theme", "system"))
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "system"
    )
    const settled = loads.length
    await page.emulateMedia({ colorScheme: "dark" })
    await page.waitForTimeout(1000)
    expect(loads).toHaveLength(settled)
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

  test("D snaps every color at once, with no ease from the old theme", async ({
    page,
  }) => {
    await signInAsDev(page)
    const toggle = sidebar(page).getByRole("button", { name: "Sidebar" })
    await expect(toggle).toBeVisible()
    // Read the toggle's ink the moment <html> turns dark, before any
    // transition could run: it must already be the new theme's.
    const atOnce = await toggle.evaluate(
      (el) =>
        new Promise<string>((resolve) => {
          new MutationObserver(() => {
            resolve(getComputedStyle(el).color)
          }).observe(document.documentElement, {
            attributeFilter: ["data-color-scheme"],
          })
          document.body.dispatchEvent(
            new KeyboardEvent("keydown", { key: "d", bubbles: true })
          )
        })
    )
    await page.waitForTimeout(300)
    expect(await toggle.evaluate((el) => getComputedStyle(el).color)).toBe(
      atOnce
    )
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
    await watchStatusBar(page)
    await signInAsDev(page)
    await expect.poll(() => statusBar(page)).toBe(LIGHT)
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
    // It's never lifted for a keyboard (app.css), whatever inset ui-sdk
    // sets; model.spec.ts fakes the short viewport iOS 26 reports.
    const viewport = page.locator('[data-slot="menu-viewport"]')
    await viewport.evaluate((el) =>
      el.style.setProperty("--keyboard-inset", "230px")
    )
    await expect(viewport).toHaveCSS("--keyboard-inset", "0px")
    const box = await theme.boundingBox()
    if (box === null) throw new Error("Theme has no box")
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark"
    )
    await expect(theme).toHaveAttribute("data-highlighted")
    await expect(theme).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")

    // iOS 26 colors the bar from the top edge, and with the drawer over it
    // keeps the color it had: the strip has it take the new one.
    await expect.poll(() => statusBar(page)).toBe(DARK)
    await expect(page.locator('[data-slot="status-bar-nudge"]')).toHaveCount(0)
    await expect(menu(page)).toBeVisible()
    await expect(drawer).toBeVisible()
    expect(await statusBar(page)).toBe(DARK)

    // Closing both keeps it; D back to light, with nothing open, too.
    await page.keyboard.press("Escape")
    await expect(menu(page)).toBeHidden()
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()
    expect(await statusBar(page)).toBe(DARK)
    await page.keyboard.press("d")
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "light"
    )
    await expect.poll(() => statusBar(page)).toBe(LIGHT)
  })

  test("in the Home Screen app, Theme in the drawer reloads at once, still open", async ({
    page,
  }) => {
    // The reload that recolors the bar happens on the tap, and the new
    // page comes back with the drawer and menu open and the draft kept.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true })
      // When the page shows again after the reload, to tell the reopened
      // drawer and menu apart from the 1.5 s cap.
      const watch = () => {
        const root = document.querySelector("html")
        if (root !== null && !root.hasAttribute("data-restoring"))
          return void Object.assign(window, { shownAt: performance.now() })
        requestAnimationFrame(watch)
      }
      watch()
      addEventListener("pagereveal", (event) => {
        Object.assign(window, { crossfaded: event.viewTransition !== null })
      })
    })
    await signInAsDev(page)
    await page.getByRole("textbox", { name: "Message" }).fill("half a thought")
    const loads: string[] = []
    page.on("load", () => loads.push(page.url()))
    const url = page.url()

    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    await drawer.getByRole("button", { name: "Dev", exact: true }).tap()
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
    await expect.poll(() => loads.length).toBe(1)
    expect(page.url()).toBe(url)

    // The new page: dark from the server, with what was open open again,
    // and shown once it is.
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark"
    )
    // The server wrote the dark color into the page iOS reads it from.
    const html = await (await page.request.get(url)).text()
    expect(html).toContain('content="#1e1d1d"')
    expect(html).not.toContain('content="#f9f8f7"')
    await expect(drawer).toBeVisible()
    await expect(menu(page)).toBeVisible()
    await expect(page.locator("html")).not.toHaveAttribute("data-restoring")
    expect(
      await page.evaluate(() => ("shownAt" in window ? window.shownAt : 0))
    ).toBeLessThan(1200)
    await expect(page.locator("body")).toHaveCSS("visibility", "visible")
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
      "half a thought"
    )
    // A real reload, the kind iOS recolors the bar on, with no crossfade:
    // a view transition's full-screen layer makes iOS keep the old color.
    expect(
      await page.evaluate(() =>
        performance
          .getEntriesByType("navigation")
          .map((entry) => ("type" in entry ? entry.type : ""))
          .join()
      )
    ).toBe("reload")
    expect(
      await page.evaluate(() => "crossfaded" in window && window.crossfaded)
    ).toBe(false)

    // Theme again, from the reopened menu: back to light, once more.
    await menu(page).getByRole("menuitem", { name: "Theme" }).click()
    await expect.poll(() => loads.length).toBe(2)
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "light"
    )
    await expect(drawer).toBeVisible()
    await page.waitForTimeout(1000)
    expect(loads).toHaveLength(2)

    // Closing them afterwards is an ordinary close, with no reload.
    await page.keyboard.press("Escape")
    await expect(menu(page)).toBeHidden()
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()
    await page.waitForTimeout(600)
    expect(loads).toHaveLength(2)
  })

  // A temporary readout for the status bar bug (status-bar-debug.tsx).
  test("the status bar readout shows from the address or three taps", async ({
    page,
  }) => {
    await signInAsDev(page)
    const readout = page.locator('[data-slot="status-bar-debug"]')
    await expect(readout).toHaveCount(0)
    await page.goto("/?debug=bar")
    await expect(readout).toContainText("build local")
    await expect(readout).toContainText("top edge:")
    await page.goto("/?debug=off")
    await expect(readout).toHaveCount(0)

    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const mark = page
      .getByRole("dialog", { name: "Chats" })
      .locator("[data-debug-taps]")
    for (let i = 0; i < 3; i++) await mark.tap()
    await expect(readout).toContainText("theme system")
  })

  // Each trial flips one live input iOS might color the bar from, without
  // a reload, so Alec can watch which (if any) moves the bar.
  test("the readout's trials flip one input each, with no reload", async ({
    page,
  }) => {
    await signInAsDev(page)
    await page.goto("/?debug=bar")
    const readout = page.locator('[data-slot="status-bar-debug"]')
    const colors = () =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLMetaElement>(
            'meta[name="theme-color"]'
          ),
        ].map((m) => `${m.content}|${m.media}`)
      )
    const before = await colors()
    const loaded = await page.evaluate(() => performance.timeOrigin)

    // In place: same tags, new content.
    const tag = await page.evaluateHandle(() =>
      document.querySelector('meta[name="theme-color"]')
    )
    await readout.getByRole("button", { name: "Edit tags" }).tap()
    expect(await tag.evaluate((m) => m?.isConnected)).toBe(true)
    expect(await colors()).toEqual(
      before.map((c) => c.replace(LIGHT_HEX, DARK_HEX))
    )
    await expect(readout).toContainText("tried tags dark")

    // One tag with no media query in place of the pair.
    await readout.getByRole("button", { name: "One tag" }).tap()
    expect(await colors()).toEqual([`${LIGHT_HEX}|`])
    await expect(readout).toContainText("tried one light")

    // The page's own background.
    await readout.getByRole("button", { name: "Page color" }).tap()
    await expect(page.locator("html")).toHaveCSS("background-color", DARK)
    await expect(readout).toContainText("tried page dark")

    expect(await page.evaluate(() => performance.timeOrigin)).toBe(loaded)
  })
})
