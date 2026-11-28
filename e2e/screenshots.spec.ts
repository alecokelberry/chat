import type { Page } from "@playwright/test"

import { expect, replies, send, settled, signInAsDev, test } from "./session"

// Screenshot tests: the key screens as pictures, so a change that moves
// a pixel by accident fails here and one meant shows up in the PR's diff.
// Each takes Playwright's own toHaveScreenshot (no service) at a phone in
// light and a computer in dark, and compares with the PNGs beside this file
// (e2e/screenshots.spec.ts-snapshots/), made on Linux, as CI is: another
// system draws text a little differently, so these skip elsewhere. Update
// them, after a change meant to move pixels, with
//   pnpm e2e e2e/screenshots.spec.ts --update-snapshots=all
// on Linux (a cloud thread), and read the changed PNGs in the PR.
//
// What keeps them still: each test signs in as its own fresh account (no
// chat but the one it makes, whichever worker or rerun it lands on), the
// mock model's reply never changes, the fonts ship with the app, Playwright
// finishes animations and hides the caret, and `settled` waits for the page
// to stop moving first.

test.skip(process.platform !== "linux", "Baselines are drawn on Linux")

const looks = [
  {
    name: "390-light",
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
  },
  {
    name: "1440-dark",
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  },
] as const

/** An account no other test uses, and none that ran before this try of
 *  this test (a rerun, a burn-in repeat), so its chat list holds only
 *  what the test made. Workers use 0 to 15, so these start at 100. */
function freshAccount(look: number, testNumber: number) {
  const { repeatEachIndex, retry } = test.info()
  const attempt = repeatEachIndex * 2 + retry
  return String(100 + attempt * 12 + look * 6 + testNumber)
}

/** A reply's "Super · 0.1s": how long the mock took varies. */
const took = (page: Page) => [page.getByText(/ · \d+(\.\d)?s$/)]

/** Sends a message in a new chat and waits for the mock's reply. */
async function chatOnce(page: Page) {
  await send(page, "Hello there")
  await expect(replies(page)).toHaveText([/Done\.$/])
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  await expect(page).toHaveURL(/\/c\//)
}

/** Opens the chat list on a phone, where it's a drawer, once it's in place. */
async function openDrawer(page: Page) {
  await page.getByRole("button", { name: "Open sidebar" }).click()
  const drawer = page.getByRole("dialog", { name: "Chats" })
  await expect
    .poll(() =>
      drawer.evaluate((el) => el.style.getPropertyValue("--drawer-progress"))
    )
    .toBe("1")
  return drawer
}

for (const [look, { name, viewport, colorScheme }] of looks.entries()) {
  test.describe(name, () => {
    test.use({ viewport, colorScheme, reducedMotion: "reduce" })

    test("a new chat", async ({ page }) => {
      await signInAsDev(page, freshAccount(look, 1))
      await settled(page)
      await expect(page).toHaveScreenshot(`new-chat-${name}.png`)
    })

    test("a saved chat", async ({ page }) => {
      await signInAsDev(page, freshAccount(look, 2))
      await chatOnce(page)
      await settled(page)
      await expect(page).toHaveScreenshot(`saved-chat-${name}.png`, {
        mask: took(page),
      })
    })

    test("the chat list", async ({ page }) => {
      await signInAsDev(page, freshAccount(look, 3))
      await chatOnce(page)
      const list =
        viewport.width < 600
          ? await openDrawer(page)
          : page.getByRole("navigation", { name: "Chats" })
      await settled(page)
      await expect(
        list.getByRole("link", { name: "Talking to the mock model" })
      ).toBeVisible()
      await settled(page)
      await expect(list).toHaveScreenshot(`chat-list-${name}.png`)
    })

    test("Search", async ({ page }) => {
      await signInAsDev(page, freshAccount(look, 4))
      await chatOnce(page)
      await page.keyboard.press("ControlOrMeta+k")
      await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible()
      await settled(page)
      await expect(page).toHaveScreenshot(`search-${name}.png`, {
        mask: [page.getByText(/^(now|\d+[smhd])$/)],
      })
    })

    test("Settings", async ({ page }) => {
      await signInAsDev(page, freshAccount(look, 5))
      const list =
        viewport.width < 600
          ? await openDrawer(page)
          : page.getByRole("navigation", { name: "Chats" })
      await list.getByRole("button", { name: "Dev", exact: true }).click()
      await page.getByRole("menuitem", { name: "Settings" }).click()
      await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible()
      await settled(page)
      await expect(page).toHaveScreenshot(`settings-${name}.png`, {
        mask: [page.getByText(/dev\+\d+@chat\.test/)],
      })
    })
  })
}
