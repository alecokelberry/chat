import { expect, send, signInAsDev, test } from "./session"

// The starters under a new chat's composer: a tap puts the words in the
// composer without sending, and they can be changed and sent as usual. They
// go once there's a draft, since the composer grows over their space, and
// come back when it's cleared.

test("a starter fills the composer, and sends once Send is pressed", async ({
  page,
}) => {
  await signInAsDev(page)
  const field = page.getByRole("textbox", { name: "Message" })
  const starters = page.getByRole("list", { name: "Starters" })
  await expect(starters.getByRole("button")).toHaveCount(3)

  await starters.getByRole("button", { name: /news today/ }).click()
  await expect(field).toHaveValue("What's in the news today?")
  await expect(field).toBeFocused()
  await expect(page).toHaveURL(/\/$/)
  await expect(starters).toHaveCount(0)

  await send(page, "What's in the news today?")
  await expect(page).toHaveURL(/\/c\//)
})

test("the starters come back when the draft is cleared", async ({ page }) => {
  await signInAsDev(page)
  const field = page.getByRole("textbox", { name: "Message" })
  const starters = page.getByRole("list", { name: "Starters" })
  await field.fill("hello")
  await expect(starters).toHaveCount(0)
  await field.clear()
  await expect(starters).toBeVisible()
})

test("an agent can see the starters and use one", async ({ page }) => {
  await signInAsDev(page)
  const result = await page.evaluate(async () => {
    const { agent } = window
    const entries = agent.snapshot().filter((entry) => entry.offPage !== true)
    const labels = entries.map((entry) => entry.label)
    const ref =
      entries.find((entry) => entry.label?.includes("news today") === true)
        ?.ref ?? ""
    const used = await agent.act({
      steps: [{ ref, action: "press", args: [] }],
    })
    return { labels, used: used.ok, error: used.error?.message }
  })
  expect(result.labels).toContain("What's in the news today?")
  expect(result.labels).toContain("Explain how compound interest works")
  expect(result.labels).toContain("Write a script that renames files in bulk")
  expect(result.used, result.error).toBe(true)
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(
    "What's in the news today?"
  )
})

// The one-line composer sits at the middle of the space under the header
// whatever is under it, with the starters shown.
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`the starters leave the composer centered at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signInAsDev(page)
    await expect(page.getByRole("list", { name: "Starters" })).toBeVisible()
    const form = await page.locator("form").boundingBox()
    const main = await page.locator("main").boundingBox()
    expect(form).not.toBeNull()
    expect(main).not.toBeNull()
    if (form === null || main === null) return
    const above = form.y - main.y
    const below = main.y + main.height - (form.y + form.height)
    expect(Math.abs(above - below)).toBeLessThan(2)
  })
}
