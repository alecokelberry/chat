import { readFileSync } from "node:fs"

import type { Page } from "@playwright/test"

import {
  expect,
  findWords,
  greeting,
  madeUpWord,
  pick,
  pickModel,
  questions,
  replies,
  send,
  settled,
  showAllChats,
  sidebar,
  signInAsDev,
  test,
  tokensOf,
  unique,
} from "./session"

// Private chat (src/routes/_app/private.tsx): the Private toggle at the top
// right of a new, empty chat moves to /private, where the composer's border
// is dashed and a line under it says the chat won't be saved. Its chat runs
// on the same agent as any other (src/lib/chat/agent.ts), which skips the
// chat list, the title, Search's index and the Library, still counts
// Usage, and wipes itself once its page is gone. These check what shows:
// that its words and files never reach the list, Search or the Library
// (a normal chat sent after it, with the same word and another file, does
// reach them, so the private one had its chance first), that a reload
// starts afresh, and that Usage counts its reply.

const SMALL = "e2e/fixtures/small.jpg"

const privateToggle = (page: Page) =>
  page.getByRole("button", { name: "Private chat" })

/** The chat list's rows. */
const chatRows = (page: Page) =>
  sidebar(page).getByRole("group", { name: "Chat list" }).getByRole("link")

/** Turns private on from a new chat. */
async function goPrivate(page: Page) {
  await expect(privateToggle(page)).toHaveAttribute("aria-pressed", "false")
  await privateToggle(page).click()
  await expect(page).toHaveURL(/\/private$/)
  await expect(privateToggle(page)).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByText("appear in your history")).toBeVisible()
}

test("a private chat answers, then never reaches the list, Search or the Library", async ({
  page,
}) => {
  await signInAsDev(page)
  await showAllChats(page)
  const rows = await chatRows(page).count()
  await goPrivate(page)
  const word = madeUpWord()
  const hidden = `${unique("secret").replace(" ", "-")}.jpg`
  await pick(page, [
    { name: hidden, mimeType: "image/jpeg", buffer: readFileSync(SMALL) },
  ])
  await expect(
    page.getByRole("list", { name: "Attached files" }).locator("img")
  ).toHaveCount(1)
  await send(page, `Private ${word}`)
  await expect(replies(page)).toHaveText([/Done\.$/])
  // Still /private, the toggle gone, the header saying what it is.
  await expect(page).toHaveURL(/\/private$/)
  await expect(privateToggle(page)).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Private chat" })
  ).toBeVisible()

  // New Chat leaves it for a normal chat, which sends the same word and
  // another file.
  await sidebar(page)
    .getByRole("link", { name: "New Chat", exact: true })
    .click()
  await expect(greeting(page)).toBeVisible()
  await expect(privateToggle(page)).toHaveAttribute("aria-pressed", "false")
  const shown = `${unique("shown").replace(" ", "-")}.jpg`
  await pick(page, [
    { name: shown, mimeType: "image/jpeg", buffer: readFileSync(SMALL) },
  ])
  await expect(
    page.getByRole("list", { name: "Attached files" }).locator("img")
  ).toHaveCount(1)
  await send(page, `Saved ${word}`)
  await expect(replies(page)).toHaveText([/Done\.$/])

  // The list gains the saved chat's row, and only that one.
  await expect(chatRows(page)).toHaveCount(rows + 1)

  // Search finds the saved chat's line only.
  await findWords(page, word)
  const search = page.getByRole("dialog", { name: "Search" })
  const messages = search.getByRole("group", { name: "Messages" })
  await expect(messages.getByRole("option")).toHaveCount(1)
  await expect(messages.getByRole("option")).toContainText("Saved")
  await page.keyboard.press("Escape")
  await expect(search).toBeHidden()

  // The Library holds the saved chat's file only.
  await sidebar(page).getByRole("link", { name: "Library" }).click()
  await expect(page).toHaveURL(/\/library$/)
  const library = page.getByRole("main")
  await expect(
    library.getByRole("listitem").filter({ hasText: shown })
  ).toBeVisible()
  await expect(
    library.getByRole("listitem").filter({ hasText: hidden })
  ).toHaveCount(0)
})

test("a reload ends a private chat and starts a fresh one", async ({
  page,
}) => {
  await signInAsDev(page)
  await goPrivate(page)
  await send(page, unique("Forget this"))
  await expect(replies(page)).toHaveText([/Done\.$/])
  await page.reload()
  await expect(greeting(page)).toBeVisible()
  await expect(privateToggle(page)).toHaveAttribute("aria-pressed", "true")
  await settled(page)
  await expect(questions(page)).toHaveCount(0)
  // Off again goes back to a normal new chat.
  await privateToggle(page).click()
  await expect(page).toHaveURL(/\/$/)
})

test("the toggle shows on a new chat only, not on a saved one", async ({
  page,
}) => {
  await signInAsDev(page)
  await expect(privateToggle(page)).toBeVisible()
  await send(page, unique("A saved chat"))
  await expect(replies(page)).toHaveText([/Done\.$/])
  await expect(page).toHaveURL(/\/c\//)
  await expect(privateToggle(page)).toHaveCount(0)
})

test("Usage counts a private chat's reply", async ({ page }) => {
  await signInAsDev(page)
  const before = await tokensOf(page, "Nano Omni")
  await goPrivate(page)
  await pickModel(page, "Nano Omni")
  await send(page, unique("Count me privately"))
  await expect(replies(page)).toHaveText([/Done\.$/])
  await expect(async () => {
    expect(await tokensOf(page, "Nano Omni")).toBeGreaterThan(before)
  }).toPass()
})
