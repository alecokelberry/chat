import { readFileSync } from "node:fs"

import type { Page } from "@playwright/test"

import {
  expect,
  greeting,
  pick,
  pickModel,
  questions,
  replies,
  send,
  settled,
  sidebar,
  signInAsDev,
  test,
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

/** A made-up word of letters only, that no other test sends. */
const madeUpWord = () =>
  `zq${Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("")}`

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
  await expect(
    sidebar(page).getByRole("link", { name: /Private/ })
  ).toHaveCount(0)

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

  // Search finds the saved chat's line only.
  const search = page.getByRole("dialog", { name: "Search" })
  const messages = search.getByRole("group", { name: "Messages" })
  await expect(async () => {
    if ((await search.count()) === 0)
      await page.keyboard.press("ControlOrMeta+k")
    const field = page.getByRole("combobox", { name: "Search chats" })
    await field.fill("")
    await field.fill(word)
    await expect(messages.getByRole("option")).not.toHaveCount(0, {
      timeout: 2000,
    })
  }).toPass()
  await expect(messages.getByRole("option")).toHaveCount(1)
  await expect(messages.getByRole("option")).toContainText("Saved")
  await page.keyboard.press("Escape")
  await expect(search).toBeHidden()

  // The Library holds the saved chat's file only.
  await sidebar(page).getByRole("link", { name: "Library" }).click()
  await expect(page).toHaveURL(/\/library$/)
  const library = page.getByRole("main")
  await expect(
    library.getByRole("link").filter({ hasText: shown })
  ).toBeVisible()
  await expect(
    library.getByRole("link").filter({ hasText: hidden })
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
  const settings = page.getByRole("dialog", { name: "Settings" })
  // Other tests on this worker chat as its Dev too, so this checks the
  // count grows, not what it is.
  const tokens = async () => {
    await sidebar(page)
      .getByRole("button", { name: "Dev", exact: true })
      .click()
    await page.getByRole("menuitem", { name: "Settings" }).click()
    await settings
      .getByRole("tablist", { name: "Settings" })
      .getByRole("tab", { name: "Usage" })
      .click()
    const usage = settings.getByRole("tabpanel", { name: "Usage" })
    await expect(usage.locator('[aria-busy="false"]')).toBeVisible()
    const row = usage
      .getByRole("list", { name: "Tokens by model" })
      .getByRole("listitem")
      .filter({ hasText: "Nano Omni" })
    const text = (await row.count()) === 0 ? "0" : await row.innerText()
    await page.keyboard.press("Escape")
    await expect(settings).toBeHidden()
    return Number(/([\d,]+) tokens?$/.exec(text)?.[1]?.replaceAll(",", "") ?? 0)
  }
  const before = await tokens()
  await goPrivate(page)
  await pickModel(page, "Nano Omni")
  await send(page, unique("Count me privately"))
  await expect(replies(page)).toHaveText([/Done\.$/])
  await expect(async () => {
    expect(await tokens()).toBeGreaterThan(before)
  }).toPass()
})
