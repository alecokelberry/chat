import type { Locator, Page } from "@playwright/test"

import { BURSTS } from "@/lib/ai/mock"
import { advanceReveal, revealedText } from "@/lib/chat/smooth-text"
import {
  answeredBy,
  stoppedMetadata,
  thoughtFor,
} from "@/lib/chat/reply-metadata"

import { expect, pickModel, send, signInAsDev, test, unique } from "./session"

// What you can do with a reply (src/components/chat/reply-actions.tsx), and
// what happens when NVIDIA is busy (src/lib/ai), on the mock model. A
// message ending in "(busy N)" makes the mock answer its first N calls for
// that message with a 429, "(silent N)" never answers its first N, and
// "(stalls)" stops partway (src/lib/ai/mock.ts); each test's message is
// unique, so a rerun starts fresh.

// The mock's plain reply: no markdown in it, so the clipboard's text is
// what the screen shows.
const REPLY = /^This is the mock model talking, as .+\. Done\.$/

test("Copy puts the reply's markdown on the clipboard and says so", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await signInAsDev(page)
  await send(page, "Hello")
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(thread).toContainText("Done.")

  // The reply's Copy, not its question's.
  const actions = page.getByRole("toolbar", { name: "Reply actions" })
  await actions.getByRole("button", { name: "Copy reply" }).click()
  await expect(actions.getByRole("button", { name: "Copied" })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(REPLY)
  await expect(page.getByRole("article", { name: "Reply" })).toHaveText(copied)
  // It goes back to Copy reply after a moment.
  await expect(
    actions.getByRole("button", { name: "Copy reply" })
  ).toBeVisible()

  // The question's Copy and Edit have names of their own.
  await page.getByRole("article", { name: "Your message" }).hover()
  const question = page.getByRole("toolbar", { name: "Question actions" })
  await expect(
    question.getByRole("button", { name: "Copy message", exact: true })
  ).toBeVisible()
  await expect(
    question.getByRole("button", { name: "Edit message", exact: true })
  ).toBeVisible()
})

test("a reply says who answered and how long it took, after a reload too", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Hello")
  const actions = page.getByRole("toolbar", { name: "Reply actions" })
  // The mock streams for about two and a half seconds.
  await expect(actions).toContainText(/Super · \d\.\ds$/)
  await page.reload()
  await expect(actions).toContainText(/Super · \d\.\ds$/)
})

test("a stopped reply says how long it ran before Stop", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "Hello (paced)")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText("talking")
  await page.getByRole("button", { name: "Stop" }).click()
  const actions = page.getByRole("toolbar", { name: "Reply actions" })
  await expect(actions).toContainText(/Super · \d\.\ds$/)
  await page.reload()
  await expect(actions).toContainText(/Super · \d\.\ds$/)
})

test("answeredBy names the model, with tenths under ten seconds", () => {
  expect(answeredBy({ model: "ultra", ms: 4249 })).toBe("Ultra · 4.2s")
  expect(answeredBy({ model: "ultra", ms: 9960 })).toBe("Ultra · 10s")
  expect(answeredBy({ model: "ultra", ms: 12_600 })).toBe("Ultra · 13s")
  expect(answeredBy({ model: "super" })).toBe("Super")
  expect(answeredBy({ model: "gpt" })).toBeUndefined()
  expect(answeredBy(undefined)).toBeUndefined()
})

test("a thinking model's reasoning streams into a closed step, kept on reload", async ({
  page,
}) => {
  await signInAsDev(page)
  await pickModel(page, "Ultra")
  await send(page, "Think about this (paced)")
  const step = page.getByRole("button", { name: "Thinking…" })
  await expect(step).toBeVisible()
  await expect(step).toHaveAttribute("aria-expanded", "false")
  const thought = page.getByRole("button", { name: /^Thought for \d+s$/ })
  await expect(thought).toBeVisible()
  // Thinking first, the mock takes about five seconds.
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done.",
    { timeout: 10_000 }
  )

  await page.reload()
  await expect(thought).toHaveAttribute("aria-expanded", "false")
  await thought.click()
  await expect(thought).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("log", { name: "Messages" })).toContainText(
    "The mock model is thinking"
  )
})

test("Stop while thinking keeps the thoughts and how long they ran", async ({
  page,
}) => {
  await signInAsDev(page)
  await pickModel(page, "Ultra")
  await send(page, "Think about this (paced)")
  const thread = page.getByRole("log", { name: "Messages" })
  // Stop at the first thought, well before the thinking ends (the closed
  // panel's text is in the page, hidden until found).
  await expect(thread).toContainText("The mock")
  await page.getByRole("button", { name: "Stop" }).click()
  const thought = page.getByRole("button", { name: /^Thought for \d+s$/ })
  await expect(thought).toBeVisible()
  await expect(page.getByRole("article", { name: "Reply" })).toHaveCount(0)

  await page.reload()
  await expect(thought).toBeVisible()
  await thought.click()
  await expect(thread).toContainText("The mock")
})

test("a reply without thinking has no step", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "Hello")
  // Thinking first, the mock takes about five seconds.
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done.",
    { timeout: 10_000 }
  )
  await expect(page.getByRole("button", { name: /^Thought/ })).toHaveCount(0)
})

test("thoughtFor says how long the model thought, at least a second", () => {
  expect(thoughtFor({ thought: 12_400 })).toBe("Thought for 12s")
  expect(thoughtFor({ thought: 300 })).toBe("Thought for 1s")
  expect(thoughtFor({ thought: "soon" })).toBe("Thoughts")
  expect(thoughtFor(undefined)).toBe("Thoughts")
})

test("stoppedMetadata times a stopped reply, and its thought if still thinking", () => {
  expect(stoppedMetadata({ started: 1000, thinking: 1500 }, 4000)).toEqual({
    started: 1000,
    thinking: 1500,
    ms: 3000,
    thought: 2500,
  })
  expect(
    stoppedMetadata({ started: 1000, thinking: 1500, thought: 800 }, 4000)
  ).toEqual({ started: 1000, thinking: 1500, thought: 800, ms: 3000 })
  expect(stoppedMetadata(undefined, 4000)).toEqual({ ms: 0 })
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
  await expect(
    page
      .getByRole("toolbar", { name: "Reply actions" })
      .getByRole("button", { name: "Copy reply" })
  ).toHaveCount(2)
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

test("a silent NVIDIA ends in an error, and Retry answers", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, unique("Hello (silent 1)"))

  // The mock's call never answers; the reply gives up after its quiet
  // limit (short on the mock), not hours later.
  const error = page.getByRole("alert")
  await expect(error).toContainText("NVIDIA isn't answering", {
    timeout: 10_000,
  })
  // The waiting marker is gone.
  await expect(
    page.getByRole("log", { name: "Messages" }).getByRole("status")
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  await error.getByRole("button", { name: "Retry" }).click()
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  await expect(error).toHaveCount(0)
})

test("a reply NVIDIA stops sending partway ends in an error", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, unique("Hello (stalls)"))

  const error = page.getByRole("alert")
  await expect(error).toContainText("NVIDIA isn't answering", {
    timeout: 10_000,
  })
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
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
  // query, not snapshot: a long chat list fills the snapshot's 100
  // entries before the thread's controls.
  const result = await page.evaluate(async () => {
    const { agent } = window
    const labels = agent
      .snapshot()
      .filter((entry) => entry.offPage !== true && entry.ref !== "more")
      .map((entry) => entry.label)
    const found = await Promise.all(
      ["Reply actions", "Copy reply", "Retry"].map((text) =>
        agent.query({ text })
      )
    )
    const entries = found.flatMap((list) => ("error" in list ? [] : list))
    const copied = await agent.act({
      steps: [{ ref: "Copy reply", action: "press", args: [] }],
    })
    const retried = await agent.act({
      steps: [{ ref: "Retry", action: "press", args: [] }],
    })
    return {
      labels,
      found: entries.map((entry) => entry.label),
      copied: copied.ok,
      retried: retried.ok,
    }
  })
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.found).toEqual(
    expect.arrayContaining(["Reply actions", "Copy reply", "Retry"])
  )
  expect(result.copied).toBe(true)
  expect(result.retried).toBe(false)
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
})

// The agent test for the thinking step: it's named by what it says, and an
// agent can open it.
test("an agent can find the thinking step and open it", async ({ page }) => {
  await signInAsDev(page)
  await pickModel(page, "Ultra")
  await send(page, "Think about this")
  // Thinking first, the mock takes about five seconds.
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done.",
    { timeout: 10_000 }
  )
  const result = await page.evaluate(async () => {
    const { agent } = window
    const found = await agent.query({ text: "Thought" })
    const step =
      "error" in found
        ? undefined
        : found.find((entry) => entry.label?.startsWith("Thought for") === true)
    if (step === undefined) return { found: false, opened: false }
    const opened = await agent.act({
      steps: [{ ref: step.ref, action: "press", args: [] }],
    })
    return { found: true, opened: opened.ok }
  })
  expect(result).toEqual({ found: true, opened: true })
  await expect(
    page.getByRole("button", { name: /^Thought for \d+s$/ })
  ).toHaveAttribute("aria-expanded", "true")
})

// Smooth streaming (src/lib/chat/smooth-text.ts): the mock's "burst" reply
// comes in three big chunks; the browser paces them out a word at a time.

/** Keeps each text the last reply shows in window.replyTexts, from the
 *  page's first paint, so a test can see how it was revealed. */
async function recordReplyTexts(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = []
    window.replyTexts = seen
    new MutationObserver(() => {
      const replies = document.querySelectorAll('[aria-label="Reply"]')
      const text = replies[replies.length - 1]?.textContent ?? ""
      if (text !== "" && text !== seen.at(-1)) seen.push(text)
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  })
}

const replyTexts = (page: Page) => page.evaluate(() => window.replyTexts)

/** The reply's caret: its animation's name, or null when there's none. */
const caretOf = (reply: Locator) =>
  reply.evaluate((article) => {
    for (const element of article.querySelectorAll("*")) {
      const after = getComputedStyle(element, "::after")
      if (after.content === '""') return after.animationName
    }
    return null
  })

declare global {
  interface Window {
    replyTexts: string[]
  }
}

const FULL = BURSTS.join("").trim()

test("a bursty reply shows a word at a time, with a caret until it's all shown", async ({
  page,
}) => {
  await recordReplyTexts(page)
  await signInAsDev(page)
  await send(page, "Hello burst")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect.poll(() => caretOf(reply)).toBe("caret-breathe")
  await expect(reply).toHaveText(FULL, { timeout: 10_000 })
  await expect.poll(() => caretOf(reply)).toBeNull()

  // Many steps, not three bursts, and each ends at a whole word.
  const texts = await replyTexts(page)
  expect(texts.length).toBeGreaterThan(10)
  for (const text of texts) {
    expect(FULL.startsWith(text)).toBe(true)
    expect(text === FULL || /\s/.test(FULL.charAt(text.length))).toBe(true)
  }
})

test("reloading a finished chat shows its reply at once", async ({ page }) => {
  await recordReplyTexts(page)
  await signInAsDev(page)
  await send(page, "Hello burst")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toHaveText(FULL, { timeout: 10_000 })
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  await page.reload()
  await expect(reply).toHaveText(FULL)
  expect(await replyTexts(page)).toEqual([FULL])
  expect(await caretOf(reply)).toBeNull()
})

test("Stop shows what arrived at once, not paced", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "Stop this burst")
  const reply = page.getByRole("article", { name: "Reply" })
  // The first burst has arrived; it's still being paced out.
  await expect(reply).toContainText("This")
  const stop = page.getByRole("button", { name: "Stop" })
  const shown = await stop.evaluate(async (button: HTMLElement) => {
    button.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    return document.querySelector('[aria-label="Reply"]')?.textContent
  })
  // Every burst that had arrived, whole: none of it held back.
  const arrived = BURSTS.map((_, n) =>
    BURSTS.slice(0, n + 1)
      .join("")
      .trim()
  )
  expect(arrived).toContain(shown)
  await expect(reply).toHaveText(shown ?? "")
  expect(await caretOf(reply)).toBeNull()
})

test("under reduced motion the caret holds still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await signInAsDev(page)
  await send(page, "Hello burst")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect.poll(() => caretOf(reply)).toBe("none")
})

test("advanceReveal drains a burst quickly but never slower than a floor", () => {
  // 160 chars/s: about 2.5 chars a frame at 60fps, never past the end.
  expect(advanceReveal(0, 5, 16)).toBeCloseTo(2.56, 1)
  expect(advanceReveal(0, 10, 10_000)).toBe(10)
  expect(advanceReveal(0, 2000, 16)).toBeGreaterThan(advanceReveal(0, 40, 16))
  let position = 0
  let frames = 0
  while (position < 1500 && frames < 1000) {
    position = advanceReveal(position, 1500, 16)
    frames++
  }
  expect(frames * 16).toBeLessThan(1500)
})

test("revealedText shows whole words and splits a huge one", () => {
  const text = "The quick brown fox"
  expect(revealedText(text, 0)).toBe("")
  expect(revealedText(text, 5)).toBe("The quick")
  // The last word shows whole too, as far as it has arrived.
  expect(revealedText(text, 17)).toBe(text)
  expect(revealedText(text, 99)).toBe(text)
  const long = `a ${"x".repeat(80)}`
  expect(revealedText(long, 10)).toBe(long.slice(0, 10))
})
