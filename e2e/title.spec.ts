import { expect, send, signInAsDev, signInAsOwner, test } from "./session"

// The open chat's title in its pill at the top (src/routes/_app/c.$id.tsx,
// src/components/ui/header-title.tsx), on the mock model, which always
// names a chat TITLE (src/lib/ai/mock.ts). Rows named "Seeded …" come from
// e2e/seed.sql.

const TITLE = "Talking to the mock model"
// The owner's worst-case titles: long, one unbreakable word, and emoji
// with right-to-left text.
const WORST = [
  "An unreasonably long chat title that goes on and on and on and on and on and on and on and on",
  "SupercalifragilisticexpialidociousSupercalifragilisticexpialidociousSupercalifragilistic",
  "🦊🦊🦊 Emoji and 漢字 and العربية",
]

test("a chat shows its title once it has one, after a reload too", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Title me")
  const title = page.getByRole("heading", { level: 1 })
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  // Lightning names the chat only once the reply is done.
  await expect(title).toHaveCount(0)
  await expect(title).toHaveText(TITLE)
  await page.reload()
  await expect(title).toHaveText(TITLE)
})

// The tab's title (each route's head()) follows the shown one: "New chat"
// until the model names the chat, then its name, then a rename.
test("the tab is titled after the page, and follows the chat's title", async ({
  page,
}) => {
  await signInAsDev(page)
  await expect(page).toHaveTitle("New chat – Chat")
  await send(page, "Title my tab")
  await expect(page).toHaveURL(/\/c\//)
  await expect(page).toHaveTitle("New chat – Chat")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE)
  await expect(page).toHaveTitle(`${TITLE} – Chat`)

  await page.getByRole("button", { name: "Chat actions" }).click()
  await page.getByRole("menuitem", { name: "Rename" }).click()
  await page.getByRole("textbox", { name: "Chat title" }).fill("My tab")
  await page.keyboard.press("Enter")
  await expect(page).toHaveTitle("My tab – Chat")
  await page.reload()
  await expect(page).toHaveTitle("My tab – Chat")
})

for (const width of [390, 1440]) {
  test(`worst-case titles stay on one line, clear of the buttons, at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await signInAsOwner(page)
    for (const name of WORST) {
      if (width < 768)
        await page.getByRole("button", { name: "Open sidebar" }).click()
      await page.getByRole("link", { name }).click()
      const title = page.getByRole("heading", { level: 1, name })
      await expect(title).toBeVisible()
      const box = await title.boundingBox()
      expect(box?.height).toBe(40)
      expect(box?.x).toBeGreaterThanOrEqual(88)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width - 88)
    }
    // The sidebar button beside it still takes a tap.
    if (width < 768) {
      await page.getByRole("button", { name: "Open sidebar" }).click()
      await expect(page.getByRole("link", { name: "New Chat" })).toBeVisible()
    }
  })
}
