import { test as base, expect, type Page } from "@playwright/test"

import { E2E_SETUP_CODE } from "../playwright.config"

// What every e2e test shares, so parallel work never grows its own copy:
// `test` and `expect` (specs import them from here, not from
// @playwright/test; lint enforces it), signing in as Dev or as the owner
// with a wait for hydration, and sending a message from the composer. Also
// the types of ui-sdk's agent bridge (window.agent, in `--mode test` builds).
//
// `test` fails any test whose pages threw, logged an error, or logged a
// ui-sdk warning: the test build keeps ui-sdk's development checks
// (vite.config.ts), which catch misuse the types can't. A test that
// expects one lists it in `allowedProblems`.

export const test = base.extend<{
  allowedProblems: RegExp[]
  pageProblems: void
}>({
  allowedProblems: [[], { option: true }],
  pageProblems: [
    async ({ context, allowedProblems }, use) => {
      const problems: string[] = []
      context.on("weberror", (error) => {
        problems.push(`Uncaught: ${error.error().message}`)
      })
      context.on("console", (message) => {
        const text = message.text()
        const isProblem =
          message.type() === "error" ||
          (message.type() === "warning" && text.startsWith("[ui-sdk]"))
        if (isProblem) problems.push(`console.${message.type()}: ${text}`)
      })
      await use()
      const unexpected = problems.filter(
        (problem) => !allowedProblems.some((allowed) => allowed.test(problem))
      )
      expect(unexpected, "the page reported problems").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export async function signInAsDev(page: Page) {
  await page.goto("/sign-in")
  await page.getByRole("button", { name: "Sign in as Dev" }).click()
  await expect(page.getByRole("heading", { name: "Hi, Dev" })).toBeVisible()
  // Typing before React hydrates is lost; the agent bridge sees the
  // controls once it has. The bridge itself may not be there yet, so check
  // for it first: a TypeError would end the wait instead of retrying it.
  await page.waitForFunction(
    () => "agent" in window && window.agent.snapshot().length > 0
  )
}

/** Signs in as the owner (Alec) by adding a passkey on /setup, through a
 *  virtual authenticator. e2e/seed.sql gives the owner 1,000 chats. */
export async function signInAsOwner(page: Page) {
  const cdp = await page.context().newCDPSession(page)
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
  await page.goto(`/setup#${E2E_SETUP_CODE}`)
  await page.getByRole("button", { name: "Add a passkey" }).click()
  await expect(page.getByRole("heading", { name: "Hi, Alec" })).toBeVisible()
}

export async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message" }).fill(text)
  await page.keyboard.press("Enter")
}

declare global {
  interface Window {
    agent: AgentBridge
  }
}

type AgentBridge = {
  snapshot: () => { ref: string; label?: string; offPage?: boolean }[]
  act: (plan: {
    steps: { ref: string; action: string; args: unknown[] }[]
  }) => Promise<{ ok: boolean; error?: { message: string } }>
  query: (options: {
    within?: string
    text?: string
  }) => Promise<
    { error: string } | { label?: string; items: { value: unknown }[] }[]
  >
}
