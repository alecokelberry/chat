import type { Page } from "@playwright/test"

import { expect, send, signInAsDev, test } from "./session"

// The chat screen's feel, as the archived Chat had it: where a new chat's
// greeting sits, what a tap does to the composer on a phone, the waiting
// marker before a reply's first word, and a saved chat opening at your
// last message with a way to jump to the latest.

const phone = {
  viewport: { width: 393, height: 659 },
  hasTouch: true,
  isMobile: true,
}

const ringOf = (page: Page) =>
  page
    .getByRole("textbox", { name: "Message" })
    .evaluate(
      (field) => getComputedStyle(field.closest("form") ?? field).boxShadow
    )

test.describe("on a phone", () => {
  test.use(phone)

  test("the new chat sits like the archive's, and a tap doesn't ring the composer", async ({
    page,
  }) => {
    await signInAsDev(page)
    const field = page.getByRole("textbox", { name: "Message" })
    await expect(field).not.toBeFocused()

    // The greeting sits 30% down; the composer is 24px in from each edge.
    const heading = await page.getByRole("heading").boundingBox()
    expect(Math.abs((heading?.y ?? 0) - 659 * 0.3)).toBeLessThan(2)
    const composer = await page.locator("form").boundingBox()
    expect(composer?.x).toBe(24)
    expect(composer?.width).toBe(393 - 48)
    expect(composer?.height).toBe(58)
    const sendButton = await page
      .getByRole("button", { name: "Send" })
      .boundingBox()
    expect(sendButton?.width).toBe(32)

    // Tapping the page leaves the composer alone; tapping the composer
    // focuses it without a ring.
    await page.getByRole("heading").tap()
    await expect(field).not.toBeFocused()
    await field.tap()
    await expect(field).toBeFocused()
    expect(await ringOf(page)).toBe("none")
    // Moving the caret is typing, not keyboard navigation.
    await page.keyboard.type("Hi")
    await page.keyboard.press("ArrowLeft")
    expect(await ringOf(page)).toBe("none")
  })
})

test("keyboard focus rings the composer", async ({ page }) => {
  await signInAsDev(page)
  // Tab past the sidebar's New Chat and chat rows to the composer.
  const field = page.getByRole("textbox", { name: "Message" })
  await expect(async () => {
    await page.keyboard.press("Tab")
    await expect(field).toBeFocused({ timeout: 100 })
  }).toPass()
  expect(await ringOf(page)).not.toBe("none")
})

test("a reply shows the waiting marker until its first word", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Hello")
  const waiting = page.getByRole("status").filter({ hasText: "Thinking" })
  await expect(waiting).toBeVisible()
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "mock"
  )
  await expect(waiting).toBeHidden()
})

test("a saved chat opens at the last message, with a jump to the latest", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await signInAsDev(page)
  await send(page, "Hello")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText("Done.")
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  // The markdown reply is longer than the screen.
  await send(page, "Now some markdown")
  await expect(reply).toHaveCount(2)
  await expect(reply.last()).toContainText("Done.", { timeout: 15_000 })
  const thread = page.getByRole("log", { name: "Messages" })

  await page.reload()
  const last = page.getByRole("article", { name: "Your message" }).last()
  await expect(last).toHaveText("Now some markdown")
  // The last question sits at the top, its reply reading from the start.
  await expect(async () => {
    const top = (await thread.boundingBox())?.y ?? 0
    const y = (await last.boundingBox())?.y ?? Infinity
    expect(y - top).toBeLessThan(16)
  }).toPass()

  const jump = page.getByRole("button", { name: "Jump to latest" })
  await expect(jump).not.toHaveAttribute("inert")
  await jump.click()
  await expect(page.getByText("Done.").last()).toBeInViewport()
  // Faded out and inert: out of reach until there's more below again.
  await expect(jump).toHaveAttribute("inert")
})
