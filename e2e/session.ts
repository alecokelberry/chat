import { expect, type Page } from "@playwright/test"

// Helpers the chat tests share: sign in as Dev and wait for hydration, then
// send a message from the composer. Also the types of ui-sdk's agent bridge
// (window.agent, in `--mode test` builds).

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
  snapshot: () => { label?: string; offPage?: boolean }[]
  act: (plan: {
    steps: { ref: string; action: string; args: unknown[] }[]
  }) => Promise<{ ok: boolean; error?: { message: string } }>
  query: (options: {
    within?: string
    text?: string
  }) => Promise<{ error: string } | { items: { value: unknown }[] }[]>
}
