import { readFileSync } from "node:fs"

import type { Page } from "@playwright/test"

import { TOUR_TITLE } from "@/lib/chat/tour"

import {
  expect,
  pick,
  questions,
  replies,
  sidebar,
  signInAsDev,
  test,
  unique,
} from "./session"

// The Library (src/routes/_app/library.tsx): Library under New Chat (and
// in Search's actions) opens a list of every file attached in any chat,
// newest first under day groups, each showing the image itself or the
// document's kind. An image opens full screen, paging through the rest; a
// document opens in a reader; either, and each file's ⋯, downloads it or
// opens the chat it came from. A chat from before
// the Library (the feature tour, put back unindexed) shows up once the
// page has opened. A deleted chat's files leave at once, and Undo brings
// them back; an edit that takes a file out takes it out of the Library.
// Tabs and a name search narrow it, kept in the address; the order flips
// it and Grid/List switches it, kept on the device.

const SMALL = "e2e/fixtures/small.jpg" // 400 × 300
const NOTES = "e2e/fixtures/notes.pdf"

const library = (page: Page) => page.getByRole("main")
/** The Library's files, each a list item: the file, then its ⋯. */
const files = (page: Page) => library(page).getByRole("listitem")
const row = (page: Page, name: string) =>
  files(page).filter({ hasText: name }).getByRole("button").first()

/** Sends a question with a photo and a PDF named after `tag`, once both
 *  are ready, and waits for the reply. Their names. */
async function sendFiles(page: Page, tag: string) {
  const photo = `Canyon-${tag}.jpg`
  const notes = `Notes-${tag}.pdf`
  await pick(page, [
    { name: photo, mimeType: "image/jpeg", buffer: readFileSync(SMALL) },
    { name: notes, mimeType: "application/pdf", buffer: readFileSync(NOTES) },
  ])
  const attached = page.getByRole("list", { name: "Attached files" })
  await expect(attached.locator("img")).toHaveCount(1)
  await expect(attached.locator("[data-slot=file-chip]")).toContainText("PDF")
  await page
    .getByRole("textbox", { name: "Message" })
    .fill(unique("Here are the files"))
  await page.keyboard.press("Enter")
  await expect(replies(page)).toHaveText([/Done\.$/])
  return { photo, notes }
}

async function openLibrary(page: Page) {
  await sidebar(page).getByRole("link", { name: "Library" }).click()
  await expect(page).toHaveURL(/\/library$/)
  await expect(
    library(page).getByRole("heading", { name: "Library" })
  ).toBeVisible()
}

test.use({ viewport: { width: 1440, height: 900 } })

test("lists a question's files under Today; a document opens in the reader, ⋯ opens its chat", async ({
  page,
}) => {
  await signInAsDev(page)
  const { photo, notes } = await sendFiles(page, unique("a").slice(2))
  const chat = page.url()

  await openLibrary(page)
  const today = library(page).getByRole("region", { name: "Today" })
  await expect(
    today.getByRole("listitem").filter({ hasText: notes })
  ).toContainText("PDF")
  const image = row(page, photo).locator("img")
  await expect(image).toHaveAttribute("src", /\/files\//)
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
  // The newest first: the document came after the photo in the question.
  const names = await files(page).allTextContents()
  expect(names.findIndex((text) => text.includes(notes))).toBeLessThan(
    names.findIndex((text) => text.includes(photo))
  )

  // ui-sdk's agent test: an agent finds the Library and its rows by name.
  const labels = await page.evaluate(() =>
    window.agent.snapshot().map((entry) => entry.label)
  )
  expect(labels).toContain("Library")
  expect(labels.some((label) => label?.includes(notes) === true)).toBe(true)

  await row(page, notes).click()
  const reader = page.getByRole("dialog", { name: notes })
  await expect(reader).toContainText("Zion trip notes")
  await reader.getByRole("button", { name: "Close" }).click()
  await expect(reader).toHaveCount(0)

  await files(page)
    .filter({ hasText: photo })
    .getByRole("button", { name: `Actions for ${photo}` })
    .click()
  await page.getByRole("menuitem", { name: "Open chat" }).click()
  await expect(page).toHaveURL(chat)
})

test("an image opens full screen, pages round the others, downloads and opens its chat", async ({
  page,
}) => {
  await signInAsDev(page)
  const tag = unique("v").slice(2)
  const [first, second] = [`Arch-${tag}.jpg`, `Bridge-${tag}.jpg`]
  await pick(page, [
    { name: first, mimeType: "image/jpeg", buffer: readFileSync(SMALL) },
    { name: second, mimeType: "image/jpeg", buffer: readFileSync(SMALL) },
  ])
  await expect(
    page.getByRole("list", { name: "Attached files" }).locator("img")
  ).toHaveCount(2)
  await page.getByRole("textbox", { name: "Message" }).fill(unique("Two"))
  await page.keyboard.press("Enter")
  await expect(replies(page)).toHaveText([/Done\.$/])
  const chat = page.url()

  await openLibrary(page)
  await page.getByRole("searchbox", { name: "Search files" }).fill(tag)
  await expect(files(page)).toHaveCount(2)
  // Newest first: the second image was attached last.
  await row(page, second).click()
  const viewer = page.getByRole("dialog")
  await expect(viewer).toContainText(`${second} · 1 / 2`)
  await expect(viewer.getByRole("img", { name: second })).toBeVisible()
  await page.keyboard.press("ArrowRight")
  await expect(viewer).toContainText(`${first} · 2 / 2`)
  await viewer.getByRole("button", { name: "Next image" }).click()
  await expect(viewer).toContainText(`${second} · 1 / 2`)
  await viewer.getByRole("button", { name: "Previous image" }).click()
  await expect(viewer).toContainText(`${first} · 2 / 2`)

  const download = page.waitForEvent("download")
  await viewer.getByRole("link", { name: "Download" }).click()
  expect((await download).suggestedFilename()).toBe(first)

  await viewer.getByRole("link", { name: "Open chat" }).click()
  await expect(page).toHaveURL(chat)
})

test("an edit that takes a file out takes it out of the Library", async ({
  page,
}) => {
  await signInAsDev(page)
  const { photo, notes } = await sendFiles(page, unique("e").slice(2))
  await questions(page).first().hover()
  await page
    .getByRole("toolbar", { name: "Question actions" })
    .getByRole("button", { name: "Edit message" })
    .click()
  await page.getByRole("button", { name: `Remove ${photo}` }).click()
  await page.getByRole("button", { name: "Save" }).click()
  await expect(replies(page)).toHaveText([/Done\.$/])
  await expect(page.getByRole("button", { name: /^View / })).toHaveCount(0)

  await openLibrary(page)
  await expect(row(page, notes)).toBeVisible()
  await expect(row(page, photo)).toHaveCount(0)
})

test("tabs, a name search and Oldest narrow and flip the list", async ({
  page,
}) => {
  await signInAsDev(page)
  const tag = unique("x").slice(2)
  const { photo, notes } = await sendFiles(page, tag)
  await openLibrary(page)

  const tabs = page.getByRole("tablist", { name: "Show" })
  await tabs.getByRole("tab", { name: "Images" }).click()
  await expect(page).toHaveURL(/tab=images/)
  await expect(row(page, photo)).toBeVisible()
  await expect(row(page, notes)).toHaveCount(0)
  await page.reload()
  await expect(tabs.getByRole("tab", { name: "Images" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await tabs.getByRole("tab", { name: "Files" }).click()
  await expect(row(page, notes)).toBeVisible()
  await expect(row(page, photo)).toHaveCount(0)
  await tabs.getByRole("tab", { name: "All" }).click()

  const search = page.getByRole("searchbox", { name: "Search files" })
  await search.fill(`notes-${tag}`.toUpperCase())
  await expect(page).toHaveURL(/q=/)
  await expect(files(page)).toHaveCount(1)
  await expect(row(page, notes)).toBeVisible()
  await search.fill(`nothing-${tag}`)
  await expect(library(page)).toContainText("No files found")
  await search.fill(tag)
  await expect(files(page)).toHaveCount(2)

  // Newest first, the PDF last attached; Oldest flips it.
  await expect(files(page).first()).toContainText(notes)
  await page.getByRole("button", { name: "View options" }).click()
  await page.getByRole("menuitemradio", { name: "Oldest" }).click()
  await expect(files(page).first()).toContainText(photo)
  await page.reload()
  await expect(files(page).first()).toContainText(photo)
})

test("Grid shows the files as squares, List as rows, after a reload too", async ({
  page,
}) => {
  await signInAsDev(page)
  const { photo, notes } = await sendFiles(page, unique("g").slice(2))
  await openLibrary(page)

  const view = page.getByRole("group", { name: "View" })
  const grid = view.getByRole("button", { name: "Grid" })
  const list = view.getByRole("button", { name: "List" })
  await expect(grid).toHaveAttribute("aria-pressed", "true")
  const square = await row(page, photo).boundingBox()
  expect(Math.abs((square?.width ?? 0) - (square?.height ?? 1))).toBeLessThan(2)
  await expect(row(page, notes)).toContainText("PDF")

  await list.click()
  await expect(list).toHaveAttribute("aria-pressed", "true")
  await page.reload()
  await expect(list).toHaveAttribute("aria-pressed", "true")
  const line = await row(page, photo).boundingBox()
  expect(line?.width).toBeGreaterThan((line?.height ?? 0) * 4)

  // Back from a chat, without a reload, still the view last picked.
  await files(page)
    .filter({ hasText: photo })
    .getByRole("button", { name: `Actions for ${photo}` })
    .click()
  await page.getByRole("menuitem", { name: "Open chat" }).click()
  await expect(page).toHaveURL(/\/c\//)
  await page.goBack()
  await expect(page).toHaveURL(/\/library$/)
  await expect(list).toHaveAttribute("aria-pressed", "true")

  await grid.click()
  await page.reload()
  await expect(grid).toHaveAttribute("aria-pressed", "true")
})

test("Files finds a text file by a part of its name; Back clears the box", async ({
  page,
}) => {
  await signInAsDev(page)
  const tag = unique("m").slice(2)
  const list = `PackingList-${tag}.md`
  await pick(page, [
    {
      name: list,
      mimeType: "text/markdown",
      buffer: Buffer.from("# Packing\n\n- Water"),
    },
  ])
  await expect(
    page
      .getByRole("list", { name: "Attached files" })
      .locator("[data-slot=file-chip]")
  ).toContainText("Text")
  await page.getByRole("textbox", { name: "Message" }).fill(unique("List"))
  await page.keyboard.press("Enter")
  await expect(replies(page)).toHaveText([/Done\.$/])

  await openLibrary(page)
  await page
    .getByRole("tablist", { name: "Show" })
    .getByRole("tab", { name: "Files" })
    .click()
  await expect(page).toHaveURL(/tab=files/)
  const search = page.getByRole("searchbox", { name: "Search files" })
  await search.fill(`list-${tag}`)
  await expect(page).toHaveURL(/q=/)
  await expect(files(page)).toHaveCount(1)
  await expect(row(page, list)).toContainText("Text")

  // The search replaced its entry, so Back is All with no search.
  await page.goBack()
  await expect(page).toHaveURL(/\/library$/)
  await expect(search).toHaveValue("")
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

  // Deleting the tour takes its file out at once; Undo brings it back.
  const tour = sidebar(page)
    .getByRole("listitem")
    .filter({
      has: page.getByRole("link", { name: TOUR_TITLE }),
    })
  const remove = async () => {
    await tour.hover()
    await tour.getByRole("button", { name: /^Actions for / }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
  }
  await remove()
  await expect(row(page, "zion-packing-list.md")).toHaveCount(0)
  await page.getByRole("button", { name: "Undo" }).click()
  await expect(row(page, "zion-packing-list.md")).toBeVisible()

  // Deleted for good, it stays gone after a reload.
  await remove()
  await page.evaluate(() => window.toast.dismiss())
  await expect
    .poll(async () => {
      await page.reload()
      return row(page, "zion-packing-list.md").count()
    })
    .toBe(0)
})
