import { expect, greeting, send, signInAsDev, test } from "./session"

// ⌘J (Ctrl+J elsewhere) starts a new chat from anywhere, and the error and
// not-found pages (src/components/error-page.tsx) show instead of a blank
// screen. A page that threw is made by failing the chat list's request,
// which every navigation inside the app asks for again.

test("⌘J starts a new chat from a saved chat", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "Hello there")
  await expect(page).toHaveURL(/\/c\//)
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )

  await page.keyboard.press("ControlOrMeta+j")
  await expect(page).toHaveURL(/\/$/)
  await expect(greeting(page)).toBeVisible()
})

test("New Chat's tooltip names ⌘J", async ({ page }) => {
  await signInAsDev(page)
  await page
    .getByRole("link", { name: "New Chat", exact: true })
    .first()
    .hover()
  await expect(page.getByRole("tooltip")).toContainText(/⌘J|Ctrl\+J/)
})

for (const path of ["/nope", "/c/not-a-chat"]) {
  // The 404 status the page rightly answers with is logged by the browser.
  test.use({ allowedProblems: [/status of 404/] })
  test(`${path} shows not found inside the shell`, async ({ page }) => {
    await signInAsDev(page)
    await page.goto(path)
    await expect(
      page.getByRole("heading", { name: "Not found." })
    ).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Chats" })).toBeVisible()
    await page.getByRole("main").getByRole("link", { name: "New Chat" }).click()
    await expect(greeting(page)).toBeVisible()
  })
}

test.describe("a page that throws", () => {
  test.use({ allowedProblems: [/./] })

  test("shows the error page, and Try again renders it again", async ({
    page,
  }) => {
    await signInAsDev(page)
    await send(page, "Make a chat to leave")
    await expect(page.getByRole("article", { name: "Reply" })).toContainText(
      "Done."
    )
    await page.keyboard.press("ControlOrMeta+j")
    await expect(greeting(page)).toBeVisible()

    await page.route("**/_serverFn/**", (route) =>
      route.fulfill({ status: 500, body: "secret detail" })
    )
    await page
      .getByRole("navigation", { name: "Chats" })
      .getByRole("link")
      .nth(1)
      .click()
    await expect(
      page.getByRole("heading", { name: "Something went wrong." })
    ).toBeVisible()
    await expect(page.getByText("secret detail")).toHaveCount(0)

    await page.unroute("**/_serverFn/**")
    await page.getByRole("button", { name: "Try again" }).click()
    await expect(
      page.getByRole("heading", { name: "Something went wrong." })
    ).toHaveCount(0)
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible()
  })
})
