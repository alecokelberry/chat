import type { Page } from "@playwright/test"

import { expect, send, signInAsDev, test } from "./session"

// The chat screen's feel, as the archived Chat had it: where a new chat's
// greeting sits, what a tap does to the composer on a phone, the waiting
// marker before a reply's first word, a saved chat opening at your last
// message with a way to jump to the latest, and Send's tooltip.

const phone = {
  viewport: { width: 393, height: 659 },
  hasTouch: true,
  isMobile: true,
}

// The one-line composer sits as far from the top of the page area as from
// its bottom, with the greeting above it.
async function expectCentered(page: Page) {
  const box = async (selector: string) =>
    (await page.locator(selector).boundingBox()) ?? {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }
  const [heading, form, main] = await Promise.all([
    box("h1"),
    box("form"),
    box("main"),
  ])
  expect(heading.y + heading.height).toBeLessThanOrEqual(form.y)
  const above = form.y - main.y
  const below = main.y + main.height - (form.y + form.height)
  expect(Math.abs(above - below)).toBeLessThan(2)
}

const ringOf = (page: Page) =>
  page
    .getByRole("textbox", { name: "Message" })
    .evaluate(
      (field) => getComputedStyle(field.closest("form") ?? field).boxShadow
    )

test.describe("on a phone", () => {
  test.use(phone)

  test("the greeting stays put while the composer grows", async ({ page }) => {
    await signInAsDev(page)
    const before = (await page.getByRole("heading").boundingBox())?.y
    await page
      .getByRole("textbox", { name: "Message" })
      .fill("one\ntwo\nthree\nfour")
    expect((await page.getByRole("heading").boundingBox())?.y).toBe(before)
  })

  test("text that wraps takes the composer's whole width, until it's cleared", async ({
    page,
  }) => {
    await signInAsDev(page)
    const field = page.getByRole("textbox", { name: "Message" })
    const box = async (locator: ReturnType<Page["locator"]>) =>
      (await locator.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
    const attach = page.getByRole("button", { name: "Attach" })

    // One line sits between the + and the model.
    await field.fill("Hi")
    expect((await box(field)).x).toBeGreaterThan((await box(attach)).x)

    // Once it wraps, the text has a row of its own above the +, the model
    // and Send, as wide as the pill inside its 12px.
    await field.fill("What's the difference between these two pictures?")
    const form = await box(page.locator("form"))
    await expect(async () => {
      const text = await box(field)
      expect(text.width).toBe(form.width - 24 - 2)
      expect(text.y + text.height).toBeLessThanOrEqual((await box(attach)).y)
    }).toPass()
    // It stays there when shorter text would fit beside them again…
    await field.fill("What's the difference")
    expect((await box(field)).width).toBe(form.width - 24 - 2)
    // …and goes back once the text is cleared.
    await field.fill("")
    await expect(page.locator("form")).toHaveJSProperty("offsetHeight", 58)
    expect((await box(field)).x).toBeGreaterThan((await box(attach)).x)
  })

  test("the new chat sits like the archive's, and a tap doesn't ring the composer", async ({
    page,
  }) => {
    await signInAsDev(page)
    const field = page.getByRole("textbox", { name: "Message" })
    await expect(field).not.toBeFocused()

    // The composer sits centered under the header, the greeting above it;
    // the composer is 24px in from each edge.
    await expectCentered(page)
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

  test("a long draft leaves the thread in view above the keyboard", async ({
    page,
  }) => {
    await signInAsDev(page)
    await send(page, "Hello")
    await expect(page.getByRole("article", { name: "Reply" })).toContainText(
      "Done."
    )
    // About what an iPhone shows with its keyboard up.
    await page.setViewportSize({ width: 393, height: 500 })
    await page
      .getByRole("textbox", { name: "Message" })
      .fill(Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n"))
    const log = await page.getByRole("log", { name: "Messages" }).boundingBox()
    expect(log?.height).toBeGreaterThan(150)
  })

  test("a long press on a chat row doesn't select its title", async ({
    page,
  }) => {
    await signInAsDev(page)
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const row = page.getByRole("link", { name: "Seeded pinned" })
    await expect(row).toBeVisible()
    // iOS's callout (-webkit-touch-callout) is set beside it; Chromium
    // doesn't compute it, so only the selection is checked here.
    expect(await row.evaluate((el) => getComputedStyle(el).userSelect)).toBe(
      "none"
    )
  })
})

test("keyboard focus rings the composer", async ({ page }) => {
  await signInAsDev(page)
  // Tab past the sidebar's New Chat and chat rows to the composer, one
  // press per try with no wait between: toPass's default back-off waits a
  // second per press once it's warmed up, which ran past the test's 30 s.
  const field = page.getByRole("textbox", { name: "Message" })
  await expect(async () => {
    await page.keyboard.press("Tab")
    await expect(field).toBeFocused({ timeout: 100 })
  }).toPass({ intervals: [0] })
  expect(await ringOf(page)).not.toBe("none")
})

test("a reply shows the waiting marker until its first word", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Hello (paced)")
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
  // The reply is revealed at a reading pace, which a busy runner stretches
  // past the default 5 s, as the markdown reply below allows for too.
  await expect(reply).toContainText("Done.", { timeout: 15_000 })
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  // The markdown reply is longer than the screen.
  await send(page, "Now some markdown")
  await expect(reply).toHaveCount(2)
  await expect(reply.last()).toContainText("Done.", { timeout: 15_000 })
  const thread = page.getByRole("log", { name: "Messages" })

  await page.reload()
  const last = page.getByRole("article", { name: "Your message" }).last()
  await expect(last).toHaveText("Now some markdown")
  // The last question sits at the top, 24px under the phone's header as
  // in the archive, its reply reading from the start.
  await expect(async () => {
    const top = (await thread.boundingBox())?.y ?? 0
    const y = (await last.boundingBox())?.y ?? Infinity
    expect(Math.round(y - top)).toBe(24)
  }).toPass()

  const jump = page.getByRole("button", { name: "Jump to latest" })
  await expect(jump).not.toHaveAttribute("inert")
  await jump.click()
  await expect(page.getByText("Done.").last()).toBeInViewport()
  // Faded out and inert: out of reach until there's more below again.
  await expect(jump).toHaveAttribute("inert")
})

test("Send is named in a tooltip, even before there's anything to send", async ({
  page,
}) => {
  await signInAsDev(page)
  const sendButton = page.getByRole("button", { name: "Send" })
  // Still in the Tab order while there's nothing to send, so keyboards
  // reach its tooltip too.
  await expect(sendButton).toHaveAttribute("aria-disabled", "true")
  await page.getByRole("combobox", { name: "Model" }).focus()
  await page.keyboard.press("Tab")
  await expect(sendButton).toBeFocused()
  await expect(page.getByRole("tooltip")).toHaveText("Send")
  await sendButton.click({ force: true })
  await expect(page).toHaveURL(/\/$/)
})

test("on a computer the last question rests 80px down, under the title", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signInAsDev(page)
  await send(page, "Hello")
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  await page.reload()
  const question = page.getByRole("article", { name: "Your message" })
  await expect
    .poll(async () => Math.round((await question.boundingBox())?.y ?? 0))
    .toBe(80)
})
