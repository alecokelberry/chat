import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { prepareMarkdown } from "@/lib/chat/markdown"

import type { Locator } from "@playwright/test"

import { expect, send, signInAsDev, test } from "./session"

// Replies render as markdown, with highlighted code and math, in the
// browser only (src/components/chat/reply.tsx). The mock model answers a
// message that mentions "markdown" with one of each (src/lib/ai/mock.ts).

/** Waits for a reply's code to be highlighted: Streamdown shows a plain
 *  body until its lazy highlighted body loads, then swaps it in, so a
 *  size read across the swap can see a zero-size body (CI did). */
async function highlighted(reply: Locator) {
  const keyword = reply
    .locator('[data-streamdown="code-block"] span', { hasText: /^const$/ })
    .first()
  await expect(keyword).not.toHaveCSS(
    "color",
    await reply.evaluate((el) => getComputedStyle(el).color)
  )
}

test("a reply renders markdown, code and math, without raw syntax while it streams", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Show me some markdown")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toBeVisible()

  // Until it ends, no sample of the reply shows a fence or a formula's
  // source: half-written ones are held back or closed.
  const seen = new Set<string>()
  const deadline = Date.now() + 15_000
  for (let done = false; !done;) {
    expect(Date.now(), "the reply never finished").toBeLessThan(deadline)
    // What's on screen: KaTeX keeps each formula's source for screen
    // readers in a hidden .katex-mathml, which innerText would include.
    const text = await reply.evaluate((el) => {
      const copy = el.cloneNode(true)
      if (!(copy instanceof HTMLElement)) return ""
      for (const hidden of copy.querySelectorAll(".katex-mathml")) {
        hidden.remove()
      }
      return copy.innerText
    })
    seen.add(text)
    done = text.includes("Done.")
  }
  for (const text of seen) {
    // No fence, pipe, dollar pair or LaTeX source.
    expect(text).not.toMatch(/```|\||\$\$|\\|\^\{/)
  }

  await expect(
    reply.getByRole("heading", { name: "Some markdown" })
  ).toBeVisible()
  await expect(reply.getByRole("listitem")).toHaveCount(2)
  await expect(reply.getByRole("table")).toContainText("alpha")
  await expect(reply.getByRole("link", { name: "link" })).toHaveAttribute(
    "href",
    "https://example.com/"
  )
  await expect(reply.locator("code", { hasText: "inline code" })).toBeVisible()

  const block = reply.locator('[data-streamdown="code-block"]')
  await expect(block).toContainText("TypeScript")
  await expect(block).toContainText("const answer: number = 42")
  // Highlighted: the keyword has its own color.
  const keyword = block.locator("span", { hasText: /^const$/ }).first()
  await expect(keyword).not.toHaveCSS(
    "color",
    await reply.evaluate((el) => getComputedStyle(el).color)
  )

  await expect(reply.locator(".katex").first()).toBeVisible()
  await expect(reply.locator(".katex-display")).toHaveCount(1)
  await expect(reply).toContainText("a coffee costs $5.")
})

test("a long code line scrolls inside its block on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInAsDev(page)
  await send(page, "Show me some markdown")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText("Done.", { timeout: 15_000 })
  await highlighted(reply)

  const body = reply.locator('[data-streamdown="code-block-body"]')
  const sizes = () =>
    body.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }))
  // The block lays out a moment after the reply ends (the highlighter loads
  // while idle), and measures 0 wide until then.
  await expect.poll(async () => (await sizes()).client).toBeGreaterThan(0)
  await expect
    .poll(async () => {
      const { scroll, client } = await sizes()
      return scroll > client
    })
    .toBe(true)
  const { page: wide, viewport } = await sizes()
  expect(wide).toBeLessThanOrEqual(viewport)
})

test("the Worker carries no markdown renderer", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(join(dir, entry.name))
        : [join(dir, entry.name)]
    )
  const server = files("dist/server").filter((file) => file.endsWith(".js"))
  expect(server.length).toBeGreaterThan(0)
  for (const file of server) {
    expect(readFileSync(file, "utf8")).not.toMatch(/streamdown|katex|shiki/i)
  }
})

test("prepareMarkdown writes math as remark-math reads it and names languages", () => {
  expect(prepareMarkdown("Area $\\pi r^2$ and \\(e^x\\).")).toBe(
    "Area $$\\pi r^2$$ and $$e^x$$."
  )
  expect(prepareMarkdown("\\[\nx^2\n\\]")).toBe("$$\nx^2\n$$")
  expect(prepareMarkdown("\\[ x^2 \\]")).toBe("$$\nx^2\n$$")
  expect(prepareMarkdown("$$x^2$$")).toBe("$$\nx^2\n$$")
  expect(prepareMarkdown("$$\nx^2\n$$")).toBe("$$\nx^2\n$$")
  expect(prepareMarkdown("| a | $x$ |")).toBe("| a | $$x$$ |")
  expect(prepareMarkdown("$5 or $10, and $x^2$ too")).toBe(
    "$5 or $10, and $$x^2$$ too"
  )
  expect(prepareMarkdown("- one\n  \\[\n  x\n  \\]")).toBe(
    "- one\n  $$\n  x\n  $$"
  )
  expect(prepareMarkdown("```ts\nconst a = 1\n```")).toBe(
    "```TypeScript\nconst a = 1\n```"
  )
  expect(prepareMarkdown("```elixir\nx\n```")).toBe("```Elixir\nx\n```")
  expect(prepareMarkdown("```nosuchlang\nx\n```")).toBe("```nosuchlang\nx\n```")

  // While streaming, the unfinished pieces at the end wait.
  const held = (text: string) => prepareMarkdown(text, true)
  expect(held("Some code:\n```Type")).toBe("Some code:")
  expect(held("Euler: \\(e^{i")).toBe("Euler:")
  expect(held("So $x^")).toBe("So")
  expect(held("It costs $5")).toBe("It costs $5")
  expect(held("Then:\n\n$$\n\\int_0")).toBe("Then:")
  expect(held("A table:\n\n| a | b |\n| -")).toBe("A table:")
  expect(held("A table:\n\n| a | b |\n")).toBe("A table:")
  expect(held("| a | b |\n| - | - |\n| 1 |")).toBe(
    "| a | b |\n| - | - |\n| 1 |"
  )
  expect(held("```text\necho $x\n| a |")).toBe("```text\necho $x\n| a |")

  for (const text of [
    "It costs $5 and $10.",
    "From $5-$10, or $20/$30.",
    "A \\$ sign, and $ alone.",
    "Run `echo $HOME $PATH`.",
    "```sh-session\necho $x$\n\\[\n```",
  ]) {
    expect(prepareMarkdown(text)).toBe(text)
  }
})

test("code copies and folds, and a table copies and saves", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await signInAsDev(page)

  // A short block: Copy takes exactly the code, and doesn't fold.
  await send(page, "Show me some markdown")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText("Done.", { timeout: 15_000 })
  await expect(reply.getByRole("button", { name: "Show more" })).toHaveCount(0)
  const codeActions = reply.getByRole("toolbar", { name: "Code actions" })
  await codeActions.getByRole("button", { name: "Copy code" }).click()
  await expect(
    codeActions.getByRole("button", { name: "Copied" })
  ).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(/^const answer: number = 42\nconst sentence = /)
  expect(copied.endsWith("\n")).toBe(false)

  // The table: rows and columns, tab-separated, and a CSV download.
  const table = reply.locator('[data-streamdown="table-wrapper"]')
  await table.hover()
  const tableActions = table.getByRole("toolbar", { name: "Table actions" })
  await tableActions.getByRole("button", { name: "Copy table" }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Name\tValue\nalpha\t1"
  )
  const download = page.waitForEvent("download")
  await tableActions.getByRole("button", { name: "Save as CSV" }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe("table.csv")
  const path = await file.path()
  const csv = readFileSync(path, "utf8")
  expect(csv.trim().split(/\r?\n/)).toEqual(["Name,Value", "alpha,1"])
})

test("a long block folds behind Show more, by keyboard too", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Show me long code")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText("Done.", { timeout: 15_000 })
  await highlighted(reply)
  const body = reply.locator('[data-streamdown="code-block-body"]')
  const height = async () => (await body.boundingBox())?.height ?? 0
  const folded = await height()
  const more = reply.getByRole("button", { name: "Show more" })
  await more.focus()
  await page.keyboard.press("Enter")
  await expect(reply.getByRole("button", { name: "Show less" })).toBeVisible()
  expect(await height()).toBeGreaterThan(folded + 40)
  await page.keyboard.press("Enter")
  await expect(more).toBeVisible()
  expect(await height()).toBeCloseTo(folded, 0)
})
