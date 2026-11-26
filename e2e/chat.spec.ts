import { expect, test } from "@playwright/test"

import { E2E_SETUP_CODE } from "../playwright.config"
import { send, signInAsDev } from "./session"

// Chatting (src/lib/chat, src/lib/ai) on the mock model: `/` starts a chat,
// the first send moves to /c/<id>, the reply streams in and survives a
// reload, and Stop keeps what arrived. The mock's reply ends in "Done."
// after about two seconds (src/lib/ai/mock.ts).

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

test("Stop ends the reply and keeps what arrived", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "Tell me a long story")

  const reply = page.getByRole("article", { name: "Reply" }).last()
  await expect(reply).toContainText("mock")
  await page.getByRole("button", { name: "Stop" }).click()
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  const kept = await reply.innerText()
  expect(kept).not.toContain("Done.")
  // Nothing more arrives after Stop, and the partial reply is saved.
  await page.waitForTimeout(2500)
  await expect(reply).toHaveText(kept)
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

declare global {
  interface Window {
    agent: AgentBridge
  }
}

type AgentBridge = {
  snapshot: () => { label?: string; offPage?: boolean }[]
  act: (plan: {
    steps: { ref: string; action: string; args: unknown[] }[]
  }) => Promise<{ ok: boolean }>
}
