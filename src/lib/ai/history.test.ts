import type { UIMessage } from "ai"
import { expect, test } from "vitest"

import { modelMessages } from "@/lib/ai/history"

const PAGE_TEXT = "The page's whole text, which only the old reply read."
const OLD_THOUGHT = "Thinking about the first question."

const question = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
})

/** A reply that thought, read a page, then answered. */
const readingReply = (id: string): UIMessage => ({
  id,
  role: "assistant",
  parts: [
    { type: "step-start" },
    { type: "reasoning", text: OLD_THOUGHT, state: "done" },
    {
      type: "tool-readPage",
      toolCallId: `${id}-call`,
      state: "output-available",
      input: { url: "https://example.com" },
      output: { title: "Example", text: PAGE_TEXT },
    },
    { type: "step-start" },
    { type: "text", text: "The page says hello.", state: "done" },
  ],
})

const chat = [
  question("q1", "What does example.com say?"),
  readingReply("a1"),
  question("q2", "Thanks. And in French?"),
]

test("an old reply's page text and thinking don't reach the model", async () => {
  const prompt = JSON.stringify(await modelMessages(chat, true))
  expect(prompt).not.toContain(PAGE_TEXT)
  expect(prompt).not.toContain(OLD_THOUGHT)
})

test("the old answers and the new question still do", async () => {
  const prompt = JSON.stringify(await modelMessages(chat, true))
  expect(prompt).toContain("What does example.com say?")
  expect(prompt).toContain("The page says hello.")
  expect(prompt).toContain("Thanks. And in French?")
})
