import { fc, it } from "@fast-check/vitest"
import type { UIMessage } from "ai"
import { expect, test } from "vitest"

import { fitHistory, historySize, modelMessages } from "@/lib/ai/history"

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

// fitHistory: a long chat fitted to the budget, as a property for every
// chat. Sizes run from nothing to several times the budget, so the edge
// (just over, just under) is reached as often as the middle.

type Part = UIMessage["parts"][number]

const words = (length: number) => "w".repeat(length)
const size = fc.oneof(
  fc.integer({ min: 0, max: 200 }),
  fc.integer({ min: 0, max: 60_000 })
)
const attachment = fc.oneof(
  fc.constant<Part>({
    type: "file",
    mediaType: "image/jpeg",
    filename: "photo.jpg",
    url: "data:image/jpeg;base64,AAAA",
  }),
  size.map((length): Part => ({
    type: "data-document",
    data: {
      name: "notes.txt",
      mediaType: "text/plain",
      text: words(length),
      cut: false,
    },
  }))
)
const questionParts = fc.tuple(
  fc.array(attachment, { maxLength: 4 }),
  size.map((length): Part => ({ type: "text", text: words(length) }))
)
const replyParts = size.map((length): Part[] => [
  { type: "step-start" },
  { type: "reasoning", text: words(length), state: "done" },
  { type: "text", text: words(length), state: "done" },
])
const chats = fc
  .array(fc.tuple(questionParts, replyParts), { minLength: 1, maxLength: 12 })
  .map((turns): UIMessage[] =>
    turns.flatMap(([[files, text], reply], turn): UIMessage[] => [
      { id: `q${turn}`, role: "user", parts: [...files, text] },
      { id: `a${turn}`, role: "assistant", parts: reply },
    ])
  )
  // Most chats end on the question being answered; some end on a reply,
  // as one does when a reply goes on after a reload.
  .chain((chat) =>
    fc.boolean().map((answered) => (answered ? chat : chat.slice(0, -1)))
  )
  .filter((chat) => chat.length > 0)
const budgets = fc.oneof(
  fc.integer({ min: 0, max: 1_000 }),
  fc.integer({ min: 0, max: 400_000 })
)

const lastQuestionAt = (chat: UIMessage[]) =>
  chat.findLastIndex((message) => message.role === "user")

it.prop([chats, budgets])(
  "the last question and what follows it are kept whole",
  (chat, budget) => {
    const fitted = fitHistory(chat, budget)
    const from = lastQuestionAt(chat)
    expect(fitted.slice(lastQuestionAt(fitted))).toEqual(chat.slice(from))
  }
)

it.prop([chats])("a chat within the budget comes back as it was", (chat) => {
  expect(fitHistory(chat, historySize(chat))).toBe(chat)
})

it.prop([chats, budgets])(
  "the result fits, unless only the last question is left",
  (chat, budget) => {
    const fitted = fitHistory(chat, budget)
    if (lastQuestionAt(fitted) > 0) {
      expect(historySize(fitted)).toBeLessThanOrEqual(budget)
    }
  }
)

it.prop([chats, budgets])(
  "messages are only dropped from the start, and never changed",
  (chat, budget) => {
    const fitted = fitHistory(chat, budget)
    expect(fitted).toEqual(chat.slice(chat.length - fitted.length))
  }
)

it.prop([chats, budgets])(
  "the result starts with a question",
  (chat, budget) => {
    expect(fitHistory(chat, budget)[0]?.role).toBe("user")
  }
)

it.prop([chats, budgets])(
  "no more turns are dropped than the budget needs",
  (chat, budget) => {
    const cut = chat.length - fitHistory(chat, budget).length
    if (cut === 0) return
    // The chat from the last dropped question on is over budget.
    const dropped = lastQuestionAt(chat.slice(0, cut))
    expect(historySize(chat.slice(dropped))).toBeGreaterThan(budget)
  }
)

it.prop([chats, budgets])("fitting twice changes nothing", (chat, budget) => {
  const fitted = fitHistory(chat, budget)
  expect(fitHistory(fitted, budget)).toEqual(fitted)
})
