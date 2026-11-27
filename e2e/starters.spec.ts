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
