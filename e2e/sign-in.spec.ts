import { generateKeyPairSync, randomBytes } from "node:crypto"

import { BASE_URL } from "../playwright.config"

import {
  addAuthenticator,
  expect,
  expectSignedInAs,
  hydrated,
  signInAsOwner,
  test,
} from "./session"

// Signing in (src/lib/auth): only a signed-in browser reaches Chat, the
// first passkey needs the setup code, and the passkey then signs in. A
// passkey this server doesn't know isn't offered.
// Chromium's virtual authenticator stands in for Touch ID.

test("signed out, Chat sends you to sign in", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(
    page.getByRole("button", { name: "Sign in with passkey" })
  ).toBeVisible()
  await expect(page).toHaveTitle("Sign in – Chat")
})

test.describe(() => {
  // The server refuses the code, and the browser logs the 401.
  test.use({ allowedProblems: [/status of 401/] })

  test("a wrong setup code adds no passkey", async ({ page }) => {
    await addAuthenticator(page)
    await page.goto("/setup#not-it")
    // A click before hydration is lost, and no alert follows.
    await hydrated(page)
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
  await signInAsOwner(page)

  // Signed out (cookies gone), the same passkey signs back in.
  await context.clearCookies()
  await page.goto("/")
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.getByRole("button", { name: "Sign in with passkey" }).click()
  await expectSignedInAs(page, "Alec Okelberry")
})

test("Dev signs in on this machine without a passkey", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("button", { name: "Sign in as Dev" }).click()
  await expectSignedInAs(page, "Dev")
})

test("a worker's own Dev signs in only on this machine, by number", async ({
  playwright,
}) => {
  // The same server by another name is refused, as every address but
  // localhost is (live and Previews among them). The name goes in the Host
  // header: the dev server listens on localhost alone, which can be ::1.
  const here = await playwright.request.newContext({ baseURL: BASE_URL })
  const elsewhere = BASE_URL.replace("localhost", "127.0.0.1")
  const there = await here.post("/api/auth/dev-sign-in", {
    data: { as: "1" },
    headers: { host: new URL(elsewhere).host, origin: elsewhere },
  })
  expect(there.ok()).toBe(false)
  // Here, the same request signs in: the address is what was refused.
  const mine = await here.post("/api/auth/dev-sign-in", {
    data: { as: "1" },
    headers: { origin: BASE_URL },
  })
  expect(mine.ok(), await mine.text()).toBe(true)

  // A name that isn't a number never reaches an account.
  const named = await here.post("/api/auth/dev-sign-in", {
    data: { as: "owner@chat.test" },
    headers: { origin: BASE_URL },
  })
  expect(named.status()).toBe(400)
  await here.dispose()
})

test("a passkey this server doesn't know isn't offered", async ({
  page,
  context,
}) => {
  // A passkey for this site that no account here has: left over from an
  // older database, or one re-added since. It sits on the device next to
  // the owner's real one.
  const { cdp, authenticatorId } = await signInAsOwner(page)
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

  // Signed out, sign-in asks only for passkeys the server knows, so the
  // device uses the real one without asking which.
  await context.clearCookies()
  await page.goto("/sign-in")
  await page.getByRole("button", { name: "Sign in with passkey" }).click()
  await expectSignedInAs(page, "Alec Okelberry")
})
