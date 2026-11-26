import { generateKeyPairSync, randomBytes } from "node:crypto"
import type { Page } from "@playwright/test"

import { E2E_SETUP_CODE } from "../playwright.config"
import { expect, test } from "./session"

// Signing in (src/lib/auth): only a signed-in browser reaches Chat, the
// first passkey needs the setup code, and the passkey then signs in. A
// passkey this server doesn't know is removed from the device.
// Chromium's virtual authenticator stands in for Touch ID.

async function addAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("WebAuthn.enable")
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    }
  )
  return { cdp, authenticatorId }
}

test("signed out, Chat sends you to sign in", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(
    page.getByRole("button", { name: "Sign in with passkey" })
  ).toBeVisible()
})

test.describe(() => {
  // The server refuses the code, and the browser logs the 401.
  test.use({ allowedProblems: [/status of 401/] })

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

test.describe(() => {
  // The server answers the unknown passkey with a 401, and the browser
  // logs it.
  test.use({ allowedProblems: [/status of 401/] })

  test("a passkey this server doesn't know is removed from the device", async ({
    page,
  }) => {
    // A passkey for this site that no account here has: left over from an
    // older database, or one re-added since.
    const { cdp, authenticatorId } = await addAuthenticator(page)
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
    await cdp.send("WebAuthn.addCredential", {
      authenticatorId,
      credential: {
        credentialId: randomBytes(16).toString("base64"),
        isResidentCredential: true,
        rpId: "localhost",
        privateKey: privateKey
          .export({ format: "der", type: "pkcs8" })
          .toString("base64"),
        userHandle: randomBytes(16).toString("base64"),
        signCount: 0,
      },
    })

    await page.goto("/sign-in")
    await page.getByRole("button", { name: "Sign in with passkey" }).click()
    await expect(page.getByRole("alert")).toHaveText(
      "That passkey was out of date, so it's been removed. Try again."
    )
    await expect
      .poll(
        async () =>
          (await cdp.send("WebAuthn.getCredentials", { authenticatorId }))
            .credentials.length
      )
      .toBe(0)
  })
})
