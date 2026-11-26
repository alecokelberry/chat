import { expect, test, type Page } from "@playwright/test"

import { E2E_SETUP_CODE } from "../playwright.config"
import { REPLY } from "../src/lib/ai/mock"
import { send, signInAsDev } from "./session"

// Chatting (src/lib/chat, src/lib/ai) on the mock model: `/` starts a chat,
// the first send moves to /c/<id>, the reply streams in and survives a
// reload (even mid-reply, and in a second tab), and Stop keeps what
// arrived. The mock's reply ends in "Done." after under three seconds
// (src/lib/ai/mock.ts).

test("a new chat streams the reply and keeps it after a reload", async ({
  page,
}) => {
  await signInAsDev(page)
  await expect(page).toHaveURL(/\/$/)
  await send(page, "Hello there")

  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/)
  const thread = page.getByRole("log", { name: "Messages" })
  await expect(thread).toContainText("Hello there")
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(thread).toContainText("Done.")
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("")

  await page.reload()
  await expect(thread).toContainText("Hello there")
  await expect(thread).toContainText("Done.")
})

// The mock's whole reply, once: it opens by naming the model, which has no
// spaces, then says REPLY (whose only special characters are dots).
const WHOLE_REPLY = new RegExp(
  String.raw`^This is the mock model talking, as \S+ with thinking (on|off)\. ` +
    REPLY.replaceAll(".", String.raw`\.`) +
    "$"
)

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
  await send(page, "Keep going")
  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText("mock")

  await page.reload()
  await expectStillStreaming(page)
  await expect(reply).toHaveText(WHOLE_REPLY)
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
  await send(page, "Two tabs")
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
      WHOLE_REPLY
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
  await send(page, "Tell me a long story")

  const reply = page.getByRole("article", { name: "Reply" }).last()
  await expect(reply).toContainText("mock")
  await page.getByRole("button", { name: "Stop" }).click()
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  // Once the server has stopped, the screen shows what it saved: the
  // words that reached it before the Stop did, and nothing after.
  await page.waitForTimeout(2500)
  const kept = await reply.innerText()
  expect(kept).toContain("mock")
  expect(kept).not.toContain("Done.")
  await page.reload()
  await expect(page.getByRole("article", { name: "Reply" })).toHaveText(kept)
})

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

test("an empty message doesn't send", async ({ page }) => {
  await signInAsDev(page)
  await page.getByRole("textbox", { name: "Message" }).fill("   ")
  await page.keyboard.press("Enter")
  await page.waitForTimeout(300)
  await expect(page).toHaveURL(/\/$/)
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
  const cdp = await stranger.newCDPSession(owner)
  await cdp.send("WebAuthn.enable")
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  await owner.goto(`/setup#${E2E_SETUP_CODE}`)
  await owner.getByRole("button", { name: "Add a passkey" }).click()
  await expect(owner.getByRole("heading", { name: "Hi, Alec" })).toBeVisible()
  const theirs = await stranger.request.get(messages)
  expect(theirs.status()).toBe(200)
  expect(await theirs.text()).not.toContain("Only mine")
  await stranger.close()
})

// ui-sdk's agent test (the ui-sdk skill's agent-ready page): every control
// is named, an agent can write a message, and sending needs a person.
test("an agent can find every control, and sending needs a person", async ({
  page,
}) => {
  await signInAsDev(page)
  const result = await page.evaluate(async () => {
    const { agent } = window
    const entries = agent.snapshot().filter((entry) => entry.offPage !== true)
    const typed = await agent.act({
      steps: [{ ref: "Message", action: "setValue", args: ["From an agent"] }],
    })
    const sent = await agent.act({
      steps: [{ ref: "Send", action: "press", args: [] }],
    })
    return {
      labels: entries.map((entry) => entry.label),
      typed: typed.ok,
      sent: sent.ok,
    }
  })
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.labels).toEqual(expect.arrayContaining(["Message", "Send"]))
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
  await send(page, "Hello")
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  const result = await page.evaluate(async () => {
    const { agent } = window
    const entries = agent.snapshot().filter((entry) => entry.offPage !== true)
    const stopped = await agent.act({
      steps: [{ ref: "Stop", action: "press", args: [] }],
    })
    return { labels: entries.map((entry) => entry.label), stopped: stopped.ok }
  })
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.labels).toEqual(
    expect.arrayContaining(["Messages", "Message", "Stop"])
  )
  expect(result.stopped).toBe(true)
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
})
