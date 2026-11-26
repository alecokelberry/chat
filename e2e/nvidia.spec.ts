import { expect, test } from "@playwright/test"

// The one real-NVIDIA check (`pnpm smoke`, by hand before a deploy): Super
// answers through the AI Gateway, with thinking off. Every other test runs
// on the mock model. Afterwards the request shows in the gateway's logs.
test("Super answers through the AI Gateway @nvidia", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/sign-in")
  await page.getByRole("button", { name: "Sign in as Dev" }).click()
  await page.waitForFunction(
    () => "agent" in window && window.agent.snapshot().length > 0
  )
  await page
    .getByRole("textbox", { name: "Message" })
    .fill("Reply with exactly the word: pong")
  await page.keyboard.press("Enter")

  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText(/pong/i, { timeout: 45_000 })
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
})
