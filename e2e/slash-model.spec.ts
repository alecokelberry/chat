import type { Page } from "@playwright/test"

import { expect, send, signInAsDev, test } from "./session"

// Typing `/` at the start of the composer lists the models
// (src/components/chat/composer.tsx): picking one switches the model and
// keeps the text after the `/word`. Enter picks and never sends while the
// list is open.

const picker = (page: Page) => page.getByRole("combobox", { name: "Model" })
const field = (page: Page) => page.getByRole("textbox", { name: "Message" })
const list = (page: Page) => page.getByRole("listbox")

test("/ then Enter switches to the first match and clears the /", async ({
  page,
}) => {
  await signInAsDev(page)
  await field(page).focus()
  await page.keyboard.type("/ult")
  await expect(list(page).getByRole("option")).toHaveCount(1)
  await page.keyboard.press("Enter")
  await expect(picker(page)).toContainText("Ultra")
  await expect(field(page)).toHaveValue("")
  await expect(list(page)).toHaveCount(0)
  // Enter picked: nothing was sent.
  await expect(page).toHaveURL(/\/$/)
})

test("text after the picked model stays, and the answer comes from it", async ({
  page,
}) => {
  await signInAsDev(page)
  await field(page).focus()
  await page.keyboard.type("/light")
  await page.keyboard.press("Enter")
  await page.keyboard.type("hello there")
  await expect(field(page)).toHaveValue("hello there")
  await expect(picker(page)).toContainText("Lightning")
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("article", { name: "Reply" }).last()
  ).toContainText("nvidia/nemotron-3.5-lightning-30b-a3b")
})

test("a / that isn't at the start opens nothing", async ({ page }) => {
  await signInAsDev(page)
  await field(page).fill("what is 1 /")
  await expect(list(page)).toHaveCount(0)
  await field(page).fill(" /")
  await expect(list(page)).toHaveCount(0)
})

test("Escape closes the list and keeps the text", async ({ page }) => {
  await signInAsDev(page)
  await field(page).focus()
  await page.keyboard.type("/")
  await expect(list(page).getByRole("option")).toHaveCount(4)
  await page.keyboard.press("Escape")
  await expect(list(page)).toHaveCount(0)
  await expect(field(page)).toHaveValue("/")
})

test("a model with nothing typed after it sends as usual afterwards", async ({
  page,
}) => {
  await signInAsDev(page)
  await field(page).focus()
  await page.keyboard.type("/nano")
  await page.keyboard.press("Enter")
  await expect(picker(page)).toContainText("Nano Omni")
  await send(page, "Hi")
  await expect(
    page.getByRole("article", { name: "Reply" }).last()
  ).toContainText("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
})
