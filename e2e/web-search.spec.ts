import {
  SEARCH_FAILED_REPLY,
  SEARCH_RESULTS,
  SEARCHED_REPLY,
} from "@/lib/ai/mock"
import { lastTimeZone } from "@/lib/ai/models"
import { searchedLabel, searchesOf, sourcesOf } from "@/lib/chat/searches"

import { expect, replies, send, signInAsDev, test, unique } from "./session"

// Web search in a reply (src/lib/ai/search.ts, thread.tsx, sources.tsx), on
// the mock model: a message that says "search" makes it search first, with
// canned results after a second and a half; "(search N)" asks for N
// searches, and "(search down)" makes the search fail (src/lib/ai/mock.ts).
// Nothing here reaches Keenable.

test("a question that says search shows the step, then its sources, kept on reload", async ({
  page,
}) => {
  await signInAsDev(page)
  const question = unique("Please search for the news")
  await send(page, question)
  const searching = page.getByRole("button", { name: "Searching the web…" })
  await expect(searching).toBeVisible()
  await expect(searching).toHaveAttribute("aria-expanded", "false")
  const searched = page.getByRole("button", { name: "Searched · 5 sites" })
  await expect(searched).toBeVisible()
  await expect(replies(page)).toHaveText(SEARCHED_REPLY)

  const sources = page.getByRole("button", { name: "5 sources" })
  await sources.click()
  const menu = page.getByRole("menu")
  await expect(menu.getByRole("menuitem")).toHaveCount(SEARCH_RESULTS.length)
  const first = menu.getByRole("menuitem", {
    name: "Example Domain, example.com",
  })
  await expect(first).toHaveAttribute("href", "https://example.com/")
  await expect(first).toHaveAttribute("target", "_blank")
  await expect(first).toHaveAttribute("rel", "noopener noreferrer")
  await page.keyboard.press("Escape")

  await page.reload()
  await expect(searched).toHaveAttribute("aria-expanded", "false")
  await expect(sources).toBeVisible()
  await searched.click()
  await expect(searched).toHaveAttribute("aria-expanded", "true")
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(thread.getByText("Example Domain · example.com")).toBeVisible()
})

test("a simple question doesn't search", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "Hello")
  await expect(replies(page)).toContainText("Done.")
  // No "Searching…" or "Searched · …" step (Search, the icon, is another).
  await expect(
    page.getByRole("button", { name: /^Search(ing|ed)/ })
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: /sources?$/ })).toHaveCount(0)
})

test("a failed search still gets a reply, saying it couldn't search", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, unique("Please search for this (search down)"))
  const step = page.getByRole("button", { name: "Couldn't search the web" })
  await expect(step).toBeVisible()
  await expect(replies(page)).toHaveText(SEARCH_FAILED_REPLY)
  await step.click()
  await expect(
    page.getByText("The web search failed, so nothing was found.")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: /sources?$/ })).toHaveCount(0)
})

test("Stop during a search stops it", async ({ page }) => {
  await signInAsDev(page)
  await send(page, unique("Please search for the news"))
  await expect(
    page.getByRole("button", { name: "Searching the web…" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Stop" }).click()
  await expect(
    page.getByRole("button", { name: "Search stopped" })
  ).toBeVisible()
  // The mock's results come a second and a half after a search starts. A
  // second search, started after Stop, finishing proves the stopped one's
  // time has passed, with nothing to show for it.
  await send(page, unique("Then search for the weather"))
  await expect(
    page.getByRole("button", { name: "Searched · 5 sites" })
  ).toBeVisible()
  // One reply and one set of sources, both the second question's.
  await expect(replies(page)).toHaveText([SEARCHED_REPLY])
  await expect(page.getByRole("button", { name: /sources?$/ })).toHaveCount(1)
})

test("a reply searches at most three times", async ({ page }) => {
  await signInAsDev(page)
  await send(page, unique("Please search for the news (search 5)"))
  const searched = page.getByRole("button", { name: "Searched · 5 sites" })
  await expect(replies(page)).toHaveText(SEARCHED_REPLY, { timeout: 15_000 })
  await searched.click()
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(thread.getByText("Example Domain · example.com")).toHaveCount(3)
})

test("a reply searches at most three times, even all at once", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, unique("Please search for the news (search 5) (at once)"))
  await expect(replies(page)).toContainText("Done.")
  await page.getByRole("button", { name: "Searched · 5 sites" }).click()
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(thread.getByText("Example Domain · example.com")).toHaveCount(3)
  // The refusals past the cap are the model's business, not shown.
  await expect(thread.getByText(/searches this reply can make/)).toHaveCount(0)
})

// A saved reply is data: its parts are whatever was stored.
const reply = (parts: unknown[]) => ({ parts })

test("a saved search keeps only web links, and counts each site once", () => {
  const searches = searchesOf(
    reply([
      {
        type: "tool-webSearch",
        toolCallId: "1",
        state: "output-available",
        input: { query: "q" },
        output: {
          results: [
            { title: "A", url: "https://a.example/1", site: "a.example" },
            { title: "A again", url: "https://a.example/2", site: "a.example" },
            { title: "Bad", url: "javascript:alert(1)", site: "bad.example" },
            { title: 7, url: "https://b.example/", site: "b.example" },
          ],
        },
      },
    ])
  )
  expect(
    searchesOf(
      reply([
        {
          type: "tool-webSearch",
          state: "output-available",
          output: { refused: "That's the 3 searches this reply can make." },
        },
      ])
    )
  ).toEqual([])
  expect(sourcesOf(searches)).toEqual([
    { title: "A", url: "https://a.example/1", site: "a.example" },
    { title: "b.example", url: "https://b.example/", site: "b.example" },
  ])
  expect(searchedLabel(searches, false)).toBe("Searched · 2 sites")
  expect(searchedLabel(searches.slice(0, 1), true)).toBe("Searching the web…")
  const empty = searchesOf(
    reply([
      {
        type: "tool-webSearch",
        state: "output-available",
        output: { results: [] },
      },
    ])
  )
  expect(searchedLabel(empty, false)).toBe("Searched · nothing found")
})

test("the model is told the question's time zone only if it's real", () => {
  const asked = (timeZone: unknown) => [
    { role: "user", metadata: { model: "super", timeZone } },
  ]
  expect(lastTimeZone(asked("America/Denver"))).toBe("America/Denver")
  expect(lastTimeZone(asked("Not/AZone"))).toBe("UTC")
  expect(lastTimeZone(asked(42))).toBe("UTC")
  expect(lastTimeZone([])).toBe("UTC")
})
