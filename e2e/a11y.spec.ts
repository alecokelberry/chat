import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import {
  expect,
  greeting,
  pick,
  send,
  settled,
  signInAsDev,
  test,
} from "./session"

// An accessibility scan (axe-core) of the main screens, in light and dark
// at 1440 and 390: sign-in, a new chat, a chat with a markdown reply, the
// model picker, the chat list's drawer (at 390), a row's menu, the
// account menu open, attachments (tiles, a question's images and the
// viewer), and Search open with a query (its preview beside, at
// 1440) and a result's menu. It fails on serious or
// critical WCAG 2.2 AA problems, and says which rule and which elements.
// A new screen joins the list in `screens` when it lands (DESIGN.md ›
// Access).

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

async function scan(page: Page) {
  // A menu still fading in fails contrast; scan it once it's shown.
  await settled(page)
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze()
  const failures = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n` +
        v.nodes.map((n) => `  ${n.target.join(" ")}`).join("\n")
    )
  expect(failures, "accessibility problems").toEqual([])
}

const sizes = [
  { name: "1440", viewport: { width: 1440, height: 900 } },
  { name: "390", viewport: { width: 390, height: 844 } },
]

for (const colorScheme of ["light", "dark"] as const) {
  for (const { name, viewport } of sizes) {
    test.describe(`${colorScheme} at ${name}`, () => {
      test.use({ viewport, colorScheme })

      test("sign-in", async ({ page }) => {
        await page.goto("/sign-in")
        await expect(
          page.getByRole("button", { name: "Sign in as Dev" })
        ).toBeVisible()
        await scan(page)
      })

      test("a new chat, a markdown reply, and the chat's menus", async ({
        page,
      }) => {
        await signInAsDev(page)
        await expect(greeting(page)).toBeVisible()
        await scan(page)

        await send(page, "Show me some markdown")
        await expect(
          page.getByRole("article", { name: "Reply" })
        ).toContainText("Done.", { timeout: 15_000 })
        await scan(page)

        await page.getByRole("combobox", { name: "Model" }).click()
        await expect(page.getByRole("listbox")).toBeVisible()
        await scan(page)
        await page.keyboard.press("Escape")
        await expect(page.getByRole("listbox")).toBeHidden()

        // A phone hides the column: its drawer holds the list.
        let list = page.getByRole("navigation", { name: "Chats" })
        if (viewport.width < 600) {
          await page.getByRole("button", { name: "Open sidebar" }).click()
          list = page.getByRole("dialog", { name: "Chats" })
          await expect(list).toBeVisible()
          await scan(page)
        }
        const row = list
          .getByRole("listitem")
          .filter({ has: page.locator("a[aria-current=page]") })
        await row.hover()
        await row.getByRole("button", { name: /^Actions for / }).click()
        await expect(page.getByRole("menu")).toBeVisible()
        await scan(page)
        await page.keyboard.press("Escape")
        await expect(page.getByRole("menu")).toBeHidden()

        await list.getByRole("button", { name: "Dev", exact: true }).click()
        await expect(page.getByRole("menu")).toBeVisible()
        await scan(page)
      })

      test("attachments: tiles, a question's images and the viewer", async ({
        page,
      }) => {
        await signInAsDev(page)
        await pick(page, ["e2e/fixtures/small.jpg"])
        await expect(
          page.getByRole("list", { name: "Attached files" }).locator("img")
        ).toHaveCount(1)
        await scan(page)

        await send(page, "What's this?")
        await expect(
          page.getByRole("article", { name: "Reply" })
        ).toContainText("Done.", { timeout: 15_000 })
        await scan(page)

        await page.getByRole("button", { name: "View small.jpg" }).click()
        await expect(page.getByRole("dialog")).toBeVisible()
        await scan(page)
      })

      test("Search", async ({ page }) => {
        await signInAsDev(page)
        await page.keyboard.press("ControlOrMeta+k")
        const field = page.getByRole("combobox", { name: "Search chats" })
        await field.fill("seeded")
        await expect(page.getByRole("option").first()).toBeVisible()
        await scan(page)
        // A result's … open.
        const row = page.locator('[data-slot="command-row"]').first()
        await row.hover()
        await row.locator("button").click()
        // Settled, not mid-fade, so contrast is measured at full ink.
        await expect(page.getByRole("menu")).toHaveCSS("opacity", "1")
        await scan(page)
      })
    })
  }
}
