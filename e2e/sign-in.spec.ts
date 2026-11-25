import { expect, test, type Page } from "@playwright/test"

import { E2E_SETUP_CODE } from "../playwright.config"

// Signing in (src/lib/auth): only a signed-in browser reaches Chat, the
// first passkey needs the setup code, and the passkey then signs in.
// Chromium's virtual authenticator stands in for Touch ID.

async function addAuthenticator(page: Page) {
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
}

test("signed out, Chat sends you to sign in", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(
    page.getByRole("button", { name: "Sign in with passkey" })
  ).toBeVisible()
})

test("a wrong setup code adds no passkey", async ({ page }) => {
  await addAuthenticator(page)
  await page.goto("/setup#not-it")
  await page.getByRole("button", { name: "Add a passkey" }).click()
  await expect(page.getByRole("alert")).toHaveText(
    "That setup code isn't right."
  )
  await page.goto("/")
  await expect(page).toHaveURL(/\/sign-in$/)
})

test("the owner adds a passkey with the setup code and signs in with it", async ({
  page,
  context,
}) => {
  await addAuthenticator(page)
  await page.goto(`/setup#${E2E_SETUP_CODE}`)
  await page.getByRole("button", { name: "Add a passkey" }).click()
  await expect(page.getByRole("heading", { name: "Hi, Alec" })).toBeVisible()

  // Signed out (cookies gone), the same passkey signs back in.
  await context.clearCookies()
  await page.goto("/")
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.getByRole("button", { name: "Sign in with passkey" }).click()
  await expect(page.getByRole("heading", { name: "Hi, Alec" })).toBeVisible()
})

test("Dev signs in on this machine without a passkey", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("button", { name: "Sign in as Dev" }).click()
  await expect(page.getByRole("heading", { name: "Hi, Dev" })).toBeVisible()
})
