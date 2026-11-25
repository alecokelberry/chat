import { expect, type Page } from "@playwright/test"

// Helpers the chat tests share: sign in as Dev and wait for hydration, then
// send a message from the composer.

export async function signInAsDev(page: Page) {
  await page.goto("/sign-in")
  await page.getByRole("button", { name: "Sign in as Dev" }).click()
  await expect(page.getByRole("heading", { name: "Hi, Dev" })).toBeVisible()
  // Typing before React hydrates is lost; the agent bridge sees the
  // controls once it has.
  await page.waitForFunction(() => window.agent.snapshot().length > 0)
}

export async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message" }).fill(text)
  await page.keyboard.press("Enter")
}
