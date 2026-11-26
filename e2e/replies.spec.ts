import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"

import { send, signInAsDev } from "./session"

// What you can do with a reply (src/components/chat/reply-actions.tsx), and
// what happens when NVIDIA is busy (src/lib/ai), on the mock model. A
// message ending in "(busy N)" makes the mock answer its first N calls for
// that message with a 429 (src/lib/ai/mock.ts); each test's message is
// unique, so a rerun starts fresh.

// The mock's plain reply: no markdown in it, so the clipboard's text is
// what the screen shows.
const REPLY = /^This is the mock model talking, as .+\. Done\.$/

/** A message nobody has sent before, so the mock's count starts fresh. */
const unique = (text: string) => `${text} ${randomUUID().slice(0, 8)}`

test("Copy puts the reply's markdown on the clipboard and says so", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await signInAsDev(page)
  await send(page, "Hello")
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(thread).toContainText("Done.")

  await page.getByRole("button", { name: "Copy" }).click()
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(REPLY)
  await expect(page.getByRole("article", { name: "Reply" })).toHaveText(copied)
  // It goes back to Copy after a moment.
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible()
})

test("Retry replaces the last reply in place", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "First question")
  const replies = page.getByRole("article", { name: "Reply" })
  await expect(replies).toHaveText([/Done\.$/])
  // The last word arrives a moment before the reply ends; until it ends,
  // Enter doesn't send.
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  await send(page, "Second question")
  await expect(replies).toHaveText([/Done\.$/, /Done\.$/])
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  // Every reply has Copy; only the last one has Retry.
  await expect(page.getByRole("button", { name: "Copy" })).toHaveCount(2)
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(1)

  await page.getByRole("button", { name: "Retry" }).click()
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(replies).toHaveCount(2)
  await expect(replies.last()).not.toContainText("Done.")
  await expect(replies).toHaveText([/Done\.$/, /Done\.$/])
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  // The old reply is gone from the chat, not only from the screen.
  await page.reload()
  await expect(replies).toHaveText([/Done\.$/, /Done\.$/])
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(thread).toContainText("Second question")
})

test("a busy NVIDIA is retried once, quietly", async ({ page }) => {
  await signInAsDev(page)
  await send(page, unique("Hello (busy 1)"))
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done.",
    { timeout: 10_000 }
  )
  await expect(page.getByRole("alert")).toHaveCount(0)
})

test("busy twice, the error shows in the chat and Retry answers", async ({
  page,
}) => {
  await signInAsDev(page)
  const question = unique("Hello (busy 2)")
  await send(page, question)

  const error = page.getByRole("alert")
  await expect(error).toContainText("NVIDIA is busy", { timeout: 10_000 })
  await expect(page.getByRole("article", { name: "Reply" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  // The third call gets through.
  await error.getByRole("button", { name: "Retry" }).click()
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  await expect(error).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Your message" })).toHaveText(
    question
  )
})

// ui-sdk's agent test: a reply's actions are named, Copy works for an
// agent, and Retry, which sends, needs a person.
test("an agent can find a reply's actions, and Retry needs a person", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await signInAsDev(page)
  await send(page, "Hello")
  await expect(page.getByRole("log", { name: "Messages" })).toContainText(
    "Done."
  )
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  const result = await page.evaluate(async () => {
    const { agent } = window
    const entries = agent.snapshot().filter((entry) => entry.offPage !== true)
    const copied = await agent.act({
      steps: [{ ref: "Copy", action: "press", args: [] }],
    })
    const retried = await agent.act({
      steps: [{ ref: "Retry", action: "press", args: [] }],
    })
    return {
      labels: entries.map((entry) => entry.label),
      copied: copied.ok,
      retried: retried.ok,
    }
  })
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.labels).toEqual(
    expect.arrayContaining(["Reply actions", "Copy", "Retry"])
  )
  expect(result.copied).toBe(true)
  expect(result.retried).toBe(false)
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
})
