import { readFileSync } from "node:fs"

import type { Page } from "@playwright/test"

import {
  expect,
  pick,
  questions,
  replies,
  send,
  signInAsDev,
  tapInSheet,
  test,
} from "./session"

// Search (src/components/chat/search.tsx, search-chats.tsx): ⌘K or a search icon opens it,
// a dialog on a computer and a sheet on a phone. With nothing typed it
// lists the chats grouped like the sidebar; typing narrows them by title,
// fuzzily, with the matched letters in bold, and Enter or a click opens
// one. Dev's chats come from e2e/seed.sql ("Seeded …"); other tests add
// chats as Dev at the same time, so these look for their own rows. From
// two letters it also finds chats by their messages' words
// (src/lib/chat/message-index.ts), under Messages with the matching line;
// these use made-up words no other test sends, and the mock's
// "(backwards …)" for a word only a reply holds. With 1,000 chats, and
// another user's words: e2e/sidebar.spec.ts.

const dialog = (page: Page) => page.getByRole("dialog", { name: "Search" })
const field = (page: Page) =>
  page.getByRole("combobox", { name: "Search chats" })
const messages = (page: Page) =>
  dialog(page).getByRole("group", { name: "Messages" })

/** A made-up word of letters only, that no other test sends. */
const madeUpWord = () =>
  `zq${Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("")}`

/** Sends `text` in a new chat and waits for the reply; the chat's path. */
async function chatSaying(page: Page, text: string) {
  await send(page, text)
  await expect(replies(page)).toHaveText([/Done\.$/])
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  return new URL(page.url()).pathname
}

/** Opens Search and types `text` until a message match shows: the
 *  chat's words reach the index just after its reply ends. */
async function findWords(page: Page, text: string) {
  await expect(async () => {
    if ((await dialog(page).count()) === 0)
      await page.keyboard.press("ControlOrMeta+k")
    await field(page).fill("")
    await field(page).fill(text)
    await expect(messages(page).getByRole("option")).not.toHaveCount(0, {
      timeout: 2000,
    })
  }).toPass()
}

test("⌘K opens Search, typing narrows by title, and Enter opens the chat", async ({
  page,
}) => {
  await signInAsDev(page)
  await page.keyboard.press("ControlOrMeta+k")
  await expect(field(page)).toBeFocused()
  await expect(field(page)).toHaveValue("")
  // Nothing typed: the chats, in the sidebar's groups.
  await expect(
    dialog(page).getByRole("group", { name: "Pinned" })
  ).toContainText("Seeded pinned")

  // Fuzzy: the letters in order, across words.
  await field(page).fill("sdkpt")
  const kept = dialog(page).getByRole("option", { name: "Seeded kept title" })
  await expect(kept).toBeVisible()
  await expect(kept.locator("strong").first()).toHaveText("S")
  await expect(dialog(page).getByRole("option")).toHaveCount(1)

  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000006$/)
  await expect(dialog(page)).toHaveCount(0)
})

test("⌘K again or Escape closes it, even with text typed", async ({ page }) => {
  await signInAsDev(page)
  await page.keyboard.press("ControlOrMeta+k")
  await field(page).fill("seeded")
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)

  // Each open starts empty.
  await page.keyboard.press("ControlOrMeta+k")
  await expect(field(page)).toHaveValue("")
  await page.keyboard.press("ControlOrMeta+k")
  await expect(dialog(page)).toHaveCount(0)
})

test("the search icon opens it, and a click on a chat goes there", async ({
  page,
}) => {
  await signInAsDev(page)
  const button = page
    .getByRole("navigation", { name: "Chats" })
    .getByRole("button", { name: "Search" })
  await button.click()
  await field(page).fill("seeded pinned")
  await dialog(page).getByRole("option", { name: "Seeded pinned" }).click()
  await expect(page).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000005$/)
  await expect(dialog(page)).toHaveCount(0)
})

// The rail has no room beside its toggle, so Search sits above New Chat:
// one Search there, named, with its tooltip beside it, and it opens.
test("the collapsed rail has one Search, above New Chat", async ({ page }) => {
  await signInAsDev(page)
  const nav = page.getByRole("navigation", { name: "Chats" })
  await nav.getByRole("button", { name: "Sidebar" }).click()
  const search = nav.getByRole("button", { name: "Search" })
  await expect(search).toHaveCount(1)
  const newChat = nav.getByRole("link", { name: "New Chat" })
  const [above, below] = await Promise.all([
    search.boundingBox(),
    newChat.boundingBox(),
  ])
  if (below === null || above === null) throw new Error("No boxes")
  expect(below.y).toBeGreaterThanOrEqual(above.y + above.height)
  await search.hover()
  const tip = page.getByRole("tooltip")
  await expect(tip).toContainText("Search")
  const [tipBox, iconBox] = await Promise.all([
    tip.boundingBox(),
    search.boundingBox(),
  ])
  if (tipBox === null || iconBox === null) throw new Error("No boxes")
  expect(tipBox.x).toBeGreaterThan(iconBox.x + iconBox.width)
  await search.click()
  await expect(dialog(page)).toBeVisible()
})

test("no match says so", async ({ page }) => {
  await signInAsDev(page)
  await page.keyboard.press("ControlOrMeta+k")
  await field(page).fill("zzqxv")
  await expect(dialog(page)).toContainText("No chats match “zzqxv”")
  await expect(dialog(page).getByRole("option")).toHaveCount(0)
})

test("a word from a question or a reply finds its chat, with the line", async ({
  page,
}) => {
  await signInAsDev(page)
  const [asked, answered] = [madeUpWord(), madeUpWord()]
  const path = await chatSaying(
    page,
    `Where do ${asked} live? (backwards ${answered})`
  )

  // The last word typed is a prefix.
  await findWords(page, asked.slice(0, 6))
  const match = messages(page).getByRole("option")
  await expect(match).toHaveCount(1)
  await expect(match).toContainText(`Where do ${asked} live?`)
  await expect(match.locator("strong")).toHaveText(asked)

  // A word only the reply holds.
  const reversed = answered.split("").reverse().join("")
  await field(page).fill(reversed)
  await expect(messages(page).getByRole("option")).toHaveCount(1)
  await expect(messages(page).locator("strong")).toHaveText(reversed)

  // FTS5's own syntax is only text: no error, and the words still match.
  await field(page).fill(`"${asked}" -* NEAR(`)
  await expect(dialog(page)).toContainText("No chats match")
  await field(page).fill(`${asked}*"`)
  await expect(messages(page).getByRole("option")).toHaveCount(1)
  await expect(dialog(page)).not.toContainText("Couldn’t search messages")

  await messages(page).getByRole("option").click()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
  await expect(dialog(page)).toHaveCount(0)
})

test("an image's or document's file name finds its chat, but not its text", async ({
  page,
}) => {
  await signInAsDev(page)
  const [named, inside, photo] = [madeUpWord(), madeUpWord(), madeUpWord()]
  await pick(page, [
    {
      name: `${named}-notes.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(`Only the file holds ${inside}.`),
    },
    {
      name: `${photo}.jpg`,
      mimeType: "image/jpeg",
      buffer: readFileSync("e2e/fixtures/small.jpg"),
    },
  ])
  await expect(
    page
      .getByRole("list", { name: "Attached files" })
      .getByText("Text", { exact: true })
  ).toBeVisible()
  await chatSaying(page, "Sum this up")
  // A later question says the file's word, so a search for it shows a
  // match once it has run: only that question, not the one with the file.
  await send(page, `Is ${inside} in it?`)
  await expect(replies(page)).toHaveText([/Done\.$/, /Done\.$/])

  await findWords(page, named)
  await expect(messages(page).getByRole("option")).toHaveCount(1)
  await findWords(page, photo)
  await expect(messages(page).getByRole("option")).toHaveCount(1)
  await findWords(page, inside)
  await expect(messages(page).getByRole("option")).toHaveCount(1)
  await expect(messages(page).getByRole("option")).toContainText(
    `Is ${inside} in it?`
  )
})

test("one letter searches titles only, and a title match comes first", async ({
  page,
}) => {
  await signInAsDev(page)
  // Seeded kept title's question (e2e/seed.sql) holds "zanzibarite"; its
  // title doesn't, so only its words find it.
  await findWords(page, "zanzibarite")
  await expect(messages(page).getByRole("option")).toHaveText(
    /^Seeded kept title.*zanzibarite crystals/
  )
  // A word in the title too: the title row, and no repeat below.
  await field(page).fill("seeded kept zanzibarite")
  await expect(messages(page)).toHaveCount(0)
  await field(page).fill("z")
  await expect(messages(page)).toHaveCount(0)
})

test("an edited question and a deleted chat stop matching", async ({
  page,
}) => {
  await signInAsDev(page)
  const [before, after] = [madeUpWord(), madeUpWord()]
  const path = await chatSaying(page, `Tell me about ${before}`)
  await findWords(page, before)
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)

  await questions(page).first().hover()
  await page
    .getByRole("toolbar", { name: "Question actions" })
    .getByRole("button", { name: "Edit message" })
    .click()
  await page
    .getByRole("textbox", { name: "Edit question" })
    .fill(`Tell me about ${after}`)
  await page.keyboard.press("Enter")
  await expect(replies(page)).toHaveText([/Done\.$/])
  await findWords(page, after)
  await field(page).fill(before)
  await expect(dialog(page)).toContainText(`No chats match “${before}”`)
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)

  await page.getByRole("button", { name: "Chat actions" }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  const deleted = page.waitForResponse(
    (response) =>
      response.url().includes("/_serverFn/") &&
      response.request().method() === "POST"
  )
  await page.evaluate(() => window.toast.dismiss())
  expect((await deleted).ok()).toBe(true)
  await expect(page).not.toHaveURL(new RegExp(`${path}$`))
  await page.keyboard.press("ControlOrMeta+k")
  await field(page).fill(after)
  await expect(dialog(page)).toContainText(`No chats match “${after}”`)
})

test("a computer previews the highlighted chat beside the list", async ({
  page,
}) => {
  await signInAsDev(page)
  const word = madeUpWord()
  await chatSaying(page, `Preview ${word} for me`)
  const preview = dialog(page).getByRole("region", { name: "Preview" })

  // Opened, the first chat is highlighted, and previewed.
  await page.keyboard.press("ControlOrMeta+k")
  const first = dialog(page).getByRole("option").first()
  await expect(first).toHaveAttribute("aria-selected", "true")
  await expect(field(page)).toHaveAttribute(
    "aria-activedescendant",
    (await first.getAttribute("id")) ?? ""
  )
  await expect(preview).toBeVisible()

  // A match by its words: its question and its reply, read-only.
  await findWords(page, word)
  await expect(preview.getByText(`Preview ${word} for me`)).toBeVisible()
  await expect(preview.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  await expect(preview.getByRole("button")).toHaveCount(0)

  // A chat with nothing in it says so.
  await field(page).fill("seeded kept")
  await expect(preview).toHaveText("Seeded kept title has no messages yet")
})

test("a result's … renames its chat in the field's place, and deletes it", async ({
  page,
}) => {
  await signInAsDev(page)
  const word = madeUpWord()
  const path = await chatSaying(page, `Rename ${word} from Search`)
  await findWords(page, word)
  const row = messages(page).locator('[data-slot="command-row"]')

  const name = `Found ${madeUpWord()}`
  await row.hover()
  await row.locator("button").click()
  await page.getByRole("menuitem", { name: "Rename" }).click()
  const title = dialog(page).getByRole("textbox", { name: "Chat title" })
  await expect(title).toBeFocused()
  await expect(field(page)).toBeHidden()
  await title.fill(name)
  await page.keyboard.press("Enter")
  await expect(field(page)).toBeFocused()
  await expect(messages(page).getByRole("option")).toContainText(name)
  await expect(
    page.getByRole("navigation", { name: "Chats" }).getByRole("link", { name })
  ).toBeVisible()

  await row.hover()
  await row.locator("button").click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect(messages(page)).toHaveCount(0)
  await expect(field(page)).toBeFocused()
  await expect(dialog(page)).toBeVisible()
  const deleted = page.waitForResponse(
    (response) =>
      response.url().includes("/_serverFn/") &&
      response.request().method() === "POST"
  )
  await page.evaluate(() => window.toast.dismiss())
  expect((await deleted).ok()).toBe(true)
  // The open chat went, so the page went to a new one.
  await expect(page).not.toHaveURL(new RegExp(`${path}$`))
})

test("a result's Open in new tab leaves Search open", async ({ page }) => {
  await signInAsDev(page)
  await page.keyboard.press("ControlOrMeta+k")
  await field(page).fill("seeded kept")
  const row = dialog(page).locator('[data-slot="command-row"]')
  await row.hover()
  await row.locator("button").click()
  const [tab] = await Promise.all([
    page.context().waitForEvent("page"),
    page.getByRole("menuitem", { name: "Open in new tab" }).click(),
  ])
  await expect(tab).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000006$/)
  await expect(dialog(page)).toBeVisible()
  await expect(page).not.toHaveURL(/\/c\/00000000-0000-4000-8000-000000000006$/)
})

test.describe("on a touch phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test("the header's icon opens a sheet, and so does the drawer's, over it", async ({
    page,
  }) => {
    await signInAsDev(page)
    await page.getByRole("button", { name: "Search" }).tap()
    await expect(page.locator('[data-slot="dialog-content"]')).toHaveAttribute(
      "data-presentation",
      "sheet"
    )
    await tapInSheet(page.locator('[data-slot="dialog-content"]'), field(page))
    await field(page).fill("seeded kept")
    await dialog(page).getByRole("option", { name: "Seeded kept title" }).tap()
    await expect(page).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000006$/)
    // No room for a preview beside the list.
    await page.getByRole("button", { name: "Search" }).tap()
    await expect(dialog(page).getByRole("option").first()).toBeVisible()
    await expect(
      dialog(page).getByRole("region", { name: "Preview" })
    ).toBeHidden()
    await page.keyboard.press("Escape")

    // From the drawer, Search opens over it: closing Search goes back to
    // the drawer, and picking a chat closes both.
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    const drawerSearch = drawer.getByRole("button", { name: "Search" })
    await drawerSearch.tap()
    await expect(dialog(page)).toBeVisible()
    await expect(drawer).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog(page)).toHaveCount(0)
    await expect(drawer).toBeVisible()

    await drawerSearch.tap()
    await tapInSheet(page.locator('[data-slot="dialog-content"]'), field(page))
    await field(page).fill("seeded pinned")
    await dialog(page).getByRole("option", { name: "Seeded pinned" }).tap()
    await expect(page).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000005$/)
    await expect(dialog(page)).toHaveCount(0)
    await expect(drawer).toHaveCount(0)
  })
})

// ui-sdk's agent bridge (window.agent, test builds): an agent finds the
// search icon by name, opens Search, searches and runs a chat, which
// opens it. It finds each by query, not in the snapshot: the snapshot
// lists only the first 100 components, and Dev's list grows with every
// chat the other tests make, which pushed Search's field past it.
test("an agent can search and open a chat", async ({ page }) => {
  await signInAsDev(page)
  /** The ref of the on-page component labelled `label`, or "" if none. */
  const refOf = (label: string) =>
    page.evaluate(async (wanted) => {
      const found = await window.agent.query({ text: wanted })
      const match =
        "error" in found
          ? undefined
          : found.find(
              (entry) => entry.label === wanted && entry.offPage !== true
            )
      return match?.ref ?? ""
    }, label)
  const opened = await page.evaluate(
    (ref) => window.agent.act({ steps: [{ ref, action: "press", args: [] }] }),
    await refOf("Search")
  )
  // The list's code loads as Search opens.
  await expect.poll(() => refOf("Search chats")).not.toBe("")
  const search = await refOf("Search chats")
  const searched = await page.evaluate(
    (ref) =>
      window.agent.act({
        steps: [
          { ref, action: "setQuery", args: ["kept title"] },
          { ref, action: "run", args: [] },
        ],
      }),
    search
  )
  expect(opened.ok).toBe(true)
  expect(searched.ok, searched.error?.message).toBe(true)
  await expect(page).toHaveURL(/\/c\/00000000-0000-4000-8000-000000000006$/)
  await expect(dialog(page)).toHaveCount(0)
})
