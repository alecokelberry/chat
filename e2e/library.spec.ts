import { readFileSync } from "node:fs"

import type { Page } from "@playwright/test"

import { TOUR_TITLE } from "@/lib/chat/tour"

import {
  expect,
  pick,
  replies,
  sidebar,
  signInAsDev,
  test,
  unique,
} from "./session"

// The Library (src/routes/_app/library.tsx): Library under New Chat (and
// in Search's actions) opens a list of every file attached in any chat,
// newest first under day groups, each row showing the image itself or the
// document's kind and opening the chat it came from. A chat from before
// the Library (the feature tour, put back unindexed) shows up once the
// page has opened, and a deleted chat's files leave.

const SMALL = "e2e/fixtures/small.jpg" // 400 × 300
const NOTES = "e2e/fixtures/notes.pdf"

const library = (page: Page) => page.getByRole("main")
const row = (page: Page, name: string) =>
  library(page).getByRole("link").filter({ hasText: name })

async function openLibrary(page: Page) {
  await sidebar(page).getByRole("link", { name: "Library" }).click()
  await expect(page).toHaveURL(/\/library$/)
  await expect(
    library(page).getByRole("heading", { name: "Library" })
  ).toBeVisible()
}

test.use({ viewport: { width: 1440, height: 900 } })

test("lists a question's files under Today, and a row opens its chat", async ({
  page,
}) => {
  await signInAsDev(page)
  const photo = `${unique("trail").replace(" ", "-")}.jpg`
  const notes = `${unique("notes").replace(" ", "-")}.pdf`
  await pick(page, [
    { name: photo, mimeType: "image/jpeg", buffer: readFileSync(SMALL) },
    {
      name: notes,
      mimeType: "application/pdf",
      buffer: readFileSync(NOTES),
    },
  ])
  // Sent once both are ready: the photo's tile and the PDF's chip.
  const attached = page.getByRole("list", { name: "Attached files" })
  await expect(attached.locator("img")).toHaveCount(1)
  await expect(attached.locator("[data-slot=file-chip]")).toContainText("PDF")
  const message = page.getByRole("textbox", { name: "Message" })
  await message.fill(unique("Here are the files"))
  await page.keyboard.press("Enter")
  await expect(replies(page)).toHaveText([/Done\.$/])
  const chat = page.url()

  await openLibrary(page)
  const today = library(page).getByRole("region", { name: "Today" })
  await expect(
    today.getByRole("link").filter({ hasText: notes })
  ).toContainText("PDF")
  const image = row(page, photo).locator("img")
  await expect(image).toHaveAttribute("src", /\/files\//)
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
  // The newest first: the document came after the photo in the question.
  const names = await library(page).getByRole("link").allTextContents()
  expect(names.findIndex((text) => text.includes(notes))).toBeLessThan(
    names.findIndex((text) => text.includes(photo))
  )

  await row(page, notes).click()
  await expect(page).toHaveURL(chat)
})

test("Search's actions open the Library", async ({ page }) => {
  await signInAsDev(page)
  await page.keyboard.press("ControlOrMeta+k")
  await page.getByRole("option", { name: "Library", exact: true }).click()
  await expect(page).toHaveURL(/\/library$/)
})

test("a chat from before the Library fills in, and leaves when deleted", async ({
  page,
}) => {
  await signInAsDev(page)
  await sidebar(page).getByRole("button", { name: "Dev", exact: true }).click()
  await page.getByRole("menuitem", { name: "Feature tour" }).click()
  await expect(replies(page).first()).toBeVisible()

  await openLibrary(page)
  await expect(row(page, "zion-packing-list.md")).toContainText("Text")

  // Delete the tour for good, from its row's menu.
  const tour = sidebar(page)
    .getByRole("listitem")
    .filter({
      has: page.getByRole("link", { name: TOUR_TITLE }),
    })
  await tour.hover()
  await tour.getByRole("button", { name: /^Actions for / }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await page.evaluate(() => window.toast.dismiss())
  await expect
    .poll(async () => {
      await page.reload()
      return row(page, "zion-packing-list.md").count()
    })
    .toBe(0)
})
