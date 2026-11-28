import type { Page } from "@playwright/test"
import type { UIMessage } from "ai"

import { REPLY } from "../src/lib/ai/mock"
import {
  expect,
  questions,
  replies,
  send,
  signInAsDev,
  signInAsOwner,
  test,
} from "./session"

// Chatting (src/lib/chat, src/lib/ai) on the mock model: `/` starts a chat,
// the first send moves to /c/<id>, the reply streams in and survives a
// reload (even mid-reply, and in a second tab), and Stop keeps what
// arrived. The mock's reply ends in "Done.", at once, or a word at a time
// for a prompt with "(paced)" (src/lib/ai/mock.ts).

test("a new chat streams the reply and keeps it after a reload", async ({
  page,
}) => {
  await signInAsDev(page)
  await expect(page).toHaveURL(/\/$/)
  await send(page, "Hello there (paced)")

  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/)
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(thread).toContainText("Hello there")
  // The chat's own composer takes over, and focus stays in it.
  await expect(page.getByRole("textbox", { name: "Message" })).toBeFocused()
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(thread).toContainText("Done.")
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("")

  await page.reload()
  await expect(thread).toContainText("Hello there")
  await expect(thread).toContainText("Done.")
})

test("a first send by the Send button leaves focus in the composer", async ({
  page,
}) => {
  await signInAsDev(page)
  const message = page.getByRole("textbox", { name: "Message" })
  await message.fill("Sent by a click")
  await page.getByRole("button", { name: "Send" }).click()
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("log", { name: "Messages" })).toContainText(
    "Sent by a click"
  )
  await expect(message).toBeFocused()
})

// The mock's whole reply, once: it opens by naming the model, which has no
// spaces, then says REPLY (whose only special characters are dots).
const WHOLE_REPLY = new RegExp(
  String.raw`^This is the mock model talking, as \S+ with thinking (on|off)\. ` +
    REPLY.replaceAll(".", String.raw`\.`) +
    "$"
)

// Tests that open a reply mid-way send "(slow)", which streams for about ten
// seconds, not two: a reload or a second tab takes as long as the runner is
// slow, and a reply that ended meanwhile would fail them for no bug. Waiting
// for such a reply's end gets twenty, not the usual five.
const SLOW_END = { timeout: 20_000 }

// Mid-reply: the text so far is there and Stop is showing, and more text
// arrives than was there at first, before the end.
async function expectStillStreaming(page: Page) {
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText("This is the mock")
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  const soFar = await reply.innerText()
  expect(soFar).not.toContain("Done.")
  await expect(reply).not.toHaveText(soFar)
  await expect(reply).not.toContainText("Done.")
}

test("a reload mid-reply shows the text so far, then keeps streaming", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Keep going (slow)")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText("mock")

  await page.reload()
  await expectStillStreaming(page)
  await expect(reply).toHaveText(WHOLE_REPLY, SLOW_END)
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  // And it was saved whole, once.
  await page.reload()
  await expect(reply).toHaveText(WHOLE_REPLY)
})

test("a second tab on the chat shows the same reply streaming", async ({
  page,
  context,
}) => {
  await signInAsDev(page)
  await send(page, "Two tabs (slow)")
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "mock"
  )

  const other = await context.newPage()
  await other.goto(page.url())
  await expectStillStreaming(other)
  await expectStillStreaming(page)
  for (const tab of [page, other]) {
    await expect(tab.getByRole("article", { name: "Reply" })).toHaveText(
      WHOLE_REPLY,
      SLOW_END
    )
  }
})

test("Stop ends the reply and keeps what arrived", async ({ page }) => {
  // Hold the Stop on its way to the server, so words keep arriving after
  // the button is pressed, as they can on a slow connection.
  await page.routeWebSocket(/\/api\/chats\//, (ws) => {
    const server = ws.connectToServer()
    ws.onMessage((message) => {
      const delay = String(message).includes("cf_agent_chat_request_cancel")
      setTimeout(() => server.send(message), delay ? 400 : 0)
    })
  })
  await signInAsDev(page)
  await send(page, "Tell me a long story (paced)")

  const reply = page.getByRole("article", { name: "Reply" }).last()
  await expect(reply).toContainText("mock")
  await page.getByRole("button", { name: "Stop" }).click()
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  // Once the server has stopped and saved the reply (the words that
  // reached it before the Stop did), the screen shows exactly that. Wait on
  // the saved chat, not a timer: under load the Stop takes longer to land.
  const id = new URL(page.url()).pathname.split("/").pop() ?? ""
  let kept = ""
  await expect(async () => {
    kept = await savedReply(page, id)
    expect(kept).toContain("mock")
    await expect(reply).toHaveText(kept, { timeout: 1000 })
  }).toPass()
  expect(kept).not.toContain("Done.")
  await page.reload()
  await expect(page.getByRole("article", { name: "Reply" })).toHaveText(kept)
})

/** The last reply's text as the chat's agent has saved it. */
async function savedReply(page: Page, id: string) {
  const response = await page.request.get(`/api/chats/${id}/get-messages`)
  await expect(response).toBeOK()
  const messages: UIMessage[] = await response.json()
  const reply = messages.findLast((message) => message.role === "assistant")
  return (reply?.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

test("Shift+Enter starts a new line and Enter sends", async ({ page }) => {
  await signInAsDev(page)
  const message = page.getByRole("textbox", { name: "Message" })
  await message.fill("First line")
  await page.keyboard.press("Shift+Enter")
  await page.keyboard.type("Second line")
  await expect(message).toHaveValue("First line\nSecond line")
  await expect(page).toHaveURL(/\/$/)

  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/c\//)
  await expect(page.getByRole("log", { name: "Messages" })).toContainText(
    "Second line"
  )
})

// A phone's keyboard has no Shift+Return, so on a touch screen Return
// starts a new line and Send sends (createPointerKind's coarse pointer).
test.describe("on a touch screen", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test("Return starts a new line and Send sends", async ({ page }) => {
    await signInAsDev(page)
    const message = page.getByRole("textbox", { name: "Message" })
    await message.fill("First line")
    await message.press("Enter")
    await page.keyboard.type("Second line")
    await expect(message).toHaveValue("First line\nSecond line")
    await expect(page).toHaveURL(/\/$/)

    await page.getByRole("button", { name: "Send", exact: true }).tap()
    await expect(page).toHaveURL(/\/c\//)
    await expect(questions(page)).toHaveText(["First line\nSecond line"])
  })
})

test("an empty message doesn't send", async ({ page }) => {
  await signInAsDev(page)
  const message = page.getByRole("textbox", { name: "Message" })
  await message.fill("   ")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/$/)
  // A real one sent after it is the chat's only question: had the empty
  // one gone, it would have come first.
  await message.fill("A real one")
  await page.keyboard.press("Enter")
  await expect(replies(page)).toContainText("Done.")
  await expect(questions(page)).toHaveText(["A real one"])
})

test("another account can't open the chat", async ({ page, browser }) => {
  await signInAsDev(page)
  await send(page, "Only mine")
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  const id = new URL(page.url()).pathname.split("/").pop() ?? ""
  const messages = `/api/chats/${id}/get-messages`
  expect(await (await page.request.get(messages)).text()).toContain("Only mine")

  // Signed out, the chat refuses.
  const stranger = await browser.newContext()
  expect((await stranger.request.get(messages)).status()).toBe(401)

  // The owner's account, asking for the same id, gets an empty chat of its
  // own, never Dev's.
  const owner = await stranger.newPage()
  await signInAsOwner(owner)
  const theirs = await stranger.request.get(messages)
  expect(theirs.status()).toBe(200)
  expect(await theirs.text()).not.toContain("Only mine")
  await stranger.close()
})

// ui-sdk's agent test (the ui-sdk skill's agent-ready page): every control
// is named, an agent can write a message, and sending needs a person. The
// snapshot lists the first 100 controls and then a "more" entry (a long
// chat list fills it), so the composer's controls are looked up by name.
test("an agent can find every control, and sending needs a person", async ({
  page,
}) => {
  await signInAsDev(page)
  const result = await page.evaluate(async () => {
    const { agent } = window
    const entries = agent
      .snapshot()
      .filter((entry) => entry.offPage !== true && entry.ref !== "more")
    const found = await Promise.all(
      ["Message", "Send"].map((text) => agent.query({ text }))
    )
    const typed = await agent.act({
      steps: [{ ref: "Message", action: "setValue", args: ["From an agent"] }],
    })
    const sent = await agent.act({
      steps: [{ ref: "Send", action: "press", args: [] }],
    })
    return {
      labels: entries.map((entry) => entry.label),
      found: found.flatMap((list) =>
        "error" in list ? [] : list.map((entry) => entry.label)
      ),
      typed: typed.ok,
      sent: sent.ok,
    }
  })
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.found).toEqual(expect.arrayContaining(["Message", "Send"]))
  expect(result.typed).toBe(true)
  expect(result.sent).toBe(false)
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
    "From an agent"
  )
  await expect(page).toHaveURL(/\/$/)
})

test("on a chat, an agent can find the thread's controls and stop a reply", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Hello (paced)")
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  const result = await page.evaluate(async () => {
    const { agent } = window
    const entries = agent
      .snapshot()
      .filter((entry) => entry.offPage !== true && entry.ref !== "more")
    const found = await Promise.all(
      ["Messages", "Message", "Stop"].map((text) => agent.query({ text }))
    )
    const stopped = await agent.act({
      steps: [{ ref: "Stop", action: "press", args: [] }],
    })
    return {
      labels: entries.map((entry) => entry.label),
      found: found.flatMap((list) =>
        "error" in list ? [] : list.map((entry) => entry.label)
      ),
      stopped: stopped.ok,
    }
  })
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.found).toEqual(
    expect.arrayContaining(["Messages", "Message", "Stop"])
  )
  expect(result.stopped).toBe(true)
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
})

test("offline, Send waits and a line says so; the draft stays, and online again sends it", async ({
  page,
  context,
}) => {
  await signInAsDev(page)
  await send(page, "Before the network drops")
  await expect(replies(page).last()).toContainText("Done.")

  const field = page.getByRole("textbox", { name: "Message" })
  await field.fill("Typed while offline")
  const sendButton = page.getByRole("button", { name: "Send" })
  await expect(sendButton).toBeEnabled()

  await context.setOffline(true)
  const line = page.getByText("Offline. Reconnecting…")
  await expect(
    page.getByRole("status").filter({ hasText: "Offline" })
  ).toHaveCount(1)
  await expect(line.last()).toBeVisible()
  await expect(sendButton).toBeDisabled()
  // Enter doesn't send it into the void either, and the words stay.
  await field.press("Enter")
  await expect(questions(page)).toHaveCount(1)
  await expect(field).toHaveValue("Typed while offline")

  await context.setOffline(false)
  await expect(line).toHaveCount(0)
  await expect(sendButton).toBeEnabled()
  await field.press("Enter")
  await expect(questions(page)).toHaveCount(2)
  await expect(replies(page).last()).toContainText("Done.")
})

test("a page that loads online never shows the offline line, even if navigator.onLine says false", async ({
  page,
}) => {
  // iOS (the Simulator) can report false on a page that loaded fine: only
  // the browser's offline event counts.
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "onLine", { get: () => false })
  )
  await signInAsDev(page)
  await page.getByRole("textbox", { name: "Message" }).fill("Still sends")
  await expect(page.getByText("Offline. Reconnecting…")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled()
})
