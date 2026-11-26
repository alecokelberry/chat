import { expect, send, signInAsDev, test } from "./session"

// The one real-NVIDIA check (`pnpm smoke`, by hand before a deploy): Super
// answers through the AI Gateway, with thinking off. Every other test runs
// on the mock model. Afterwards the request shows in the gateway's logs.
test("Super answers through the AI Gateway @nvidia", async ({ page }) => {
  test.setTimeout(60_000)
  await signInAsDev(page)
  await send(page, "Reply with exactly the word: pong")

  const reply = page.getByRole("article", { name: "Reply" })
  await expect(reply).toContainText(/pong/i, { timeout: 45_000 })
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
})
