import type { Locator, Page } from "@playwright/test"

import { expect, greeting, signInAsDev, test } from "./session"

// The app-wide parts every page gets: the toast area
// (src/components/ui/toast.tsx), always dark, bottom right on a computer and
// at the top on a phone; press on touch (src/components/ui/press-feedback.tsx),
// which marks a pressed control data-pressing for at least 90ms; and Skip to
// content (src/components/ui/skip-link.tsx), the first Tab stop.

const region = (page: Page) =>
  page.getByRole("region", { name: "Notifications" })

/** Shows a toast through the test build's window.toast, as a feature will
 *  through toast(). */
async function showToast(page: Page, title: string, duration: number) {
  await page.evaluate(
    ([title, duration]) => window.toast(title, { duration }),
    [title, duration] as const
  )
}

/** Where a toast sits on the screen, in whole pixels. */
async function edges(toast: Locator) {
  const box = await toast.boundingBox()
  if (box === null) return null
  return {
    left: Math.round(box.x),
    top: Math.round(box.y),
    right: Math.round(box.x + box.width),
    bottom: Math.round(box.y + box.height),
    width: Math.round(box.width),
  }
}

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  for (const colorScheme of ["light", "dark"] as const) {
    test(`a toast shows dark at the bottom right and times out (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme })
      await signInAsDev(page)
      await showToast(page, "Chat deleted", 3000)

      const toast = region(page).getByRole("listitem")
      await expect(toast).toContainText("Chat deleted")
      // Dark in both themes: --toast, #363636.
      await expect(toast).toHaveCSS("background-color", "rgb(54, 54, 54)")
      // 356px wide, 24px in from the bottom right, once it has slid in.
      await expect
        .poll(() => edges(toast))
        .toMatchObject({ width: 356, right: 1440 - 24, bottom: 900 - 24 })

      await expect(toast).toHaveCount(0)
    })
  }

  test("a quick click shows the press for at least 90ms", async ({ page }) => {
    await signInAsDev(page)
    // Pressed and let go at once, as a quick tap is: timed in the page,
    // since a tap is over before a check from here could look.
    const held = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const link = document.querySelector('a[href="/"]')
          if (link === null) throw new Error("no New Chat link")
          const start = performance.now()
          new MutationObserver(() => {
            if (!link.hasAttribute("data-pressing"))
              resolve(performance.now() - start)
          }).observe(link, { attributes: true })
          const at = { bubbles: true, button: 0 }
          link.dispatchEvent(new PointerEvent("pointerdown", at))
          link.dispatchEvent(new PointerEvent("pointerup", at))
        })
    )
    expect(held).toBeGreaterThanOrEqual(85)
  })

  test("a quick press on another control clears the first", async ({
    page,
  }) => {
    await signInAsDev(page)
    const newChat = page.getByRole("link", { name: "New Chat", exact: true })
    const account = page
      .getByRole("navigation", { name: "Chats" })
      .getByRole("button", { name: "Dev", exact: true })
    // All in one go, so the second press lands inside the first's 90ms.
    await page.evaluate(() => {
      const at = { bubbles: true, button: 0 }
      const link = document.querySelector('a[href="/"]')
      const row = document.querySelector(
        'nav[aria-label="Chats"] [data-slot="sidebar-footer"] button'
      )
      if (link === null || row === null) throw new Error("missing controls")
      link.dispatchEvent(new PointerEvent("pointerdown", at))
      link.dispatchEvent(new PointerEvent("pointerup", at))
      row.dispatchEvent(new PointerEvent("pointerdown", at))
    })
    await expect(newChat).not.toHaveAttribute("data-pressing")
    await expect(account).toHaveAttribute("data-pressing", "")
  })

  test("a drag off the control lets it go", async ({ page }) => {
    await signInAsDev(page)
    const newChat = page.getByRole("link", { name: "New Chat", exact: true })
    await newChat.hover()
    await page.mouse.down()
    await expect(newChat).toHaveAttribute("data-pressing", "")
    await page.mouse.move(720, 450)
    await expect(newChat).not.toHaveAttribute("data-pressing")
    await page.mouse.up()
  })

  test("the first Tab offers Skip to content, which moves focus to the page", async ({
    page,
  }) => {
    await signInAsDev(page)
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to content" })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("main")).toBeFocused()
    // The next Tab lands in the page, not back in the sidebar: on Private
    // at its top, then the composer's +, then its text.
    await page.keyboard.press("Tab")
    await expect(
      page.getByRole("button", { name: "Private chat" })
    ).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: "Attach" })).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.getByRole("textbox", { name: "Message" })).toBeFocused()
  })

  test("an agent sees Skip to content but not the toast area", async ({
    page,
  }) => {
    await signInAsDev(page)
    await showToast(page, "Chat deleted", 5000)
    await expect(region(page)).toBeVisible()
    const labels = await page.evaluate(() =>
      window.agent.snapshot().map((entry) => entry.label)
    )
    expect(labels).toContain("Skip to content")
    expect(labels).not.toContain("Notifications")
  })
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  for (const colorScheme of ["light", "dark"] as const) {
    test(`a toast shows at the top and times out (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme })
      await signInAsDev(page)
      await showToast(page, "Chat deleted", 3000)

      const toast = region(page).getByRole("listitem")
      await expect(toast).toContainText("Chat deleted")
      await expect(toast).toHaveCSS("background-color", "rgb(54, 54, 54)")
      // Between the page's 16px gutters, 12px down, once it has slid in.
      await expect
        .poll(() => edges(toast))
        .toMatchObject({ left: 16, right: 390 - 16, top: 12 })

      await expect(toast).toHaveCount(0)
    })
  }

  test("a tap shows the press", async ({ page }) => {
    await signInAsDev(page)
    await expect(greeting(page)).toBeVisible()
    const open = page.getByRole("button", { name: "Open sidebar" })
    // Recorded as it happens: a tap is over before a check could look.
    await page.evaluate(() => {
      const seen: boolean[] = []
      Object.assign(window, { pressSeen: seen })
      new MutationObserver((records) => {
        for (const record of records)
          if (record.attributeName === "data-pressing")
            if (record.target instanceof Element)
              seen.push(record.target.hasAttribute("data-pressing"))
      }).observe(document.body, { attributes: true, subtree: true })
    })
    await open.tap()
    await expect
      .poll(() => page.evaluate(() => window.pressSeen))
      .toEqual([true, false])
  })
})

declare global {
  interface Window {
    toast: typeof import("@ui-sdk/react/toast").toast
    pressSeen?: boolean[]
  }
}
