import { test as base, expect, type Locator, type Page } from "@playwright/test"

import { E2E_SETUP_CODE } from "../playwright.config"

// What every e2e test shares, so parallel work never grows its own copy:
// `test` and `expect` (specs import them from here, not from
// @playwright/test; lint enforces it), signing in as Dev or as the owner
// with a wait for hydration, and sending a message from the composer. Also
// the types of ui-sdk's agent bridge (window.agent, in `--mode test` builds).
//
// `test` fails any test whose pages threw, logged an error, or logged a
// ui-sdk warning: the test build keeps ui-sdk's development checks
// (vite.config.ts), which catch misuse the types can't. A test that
// expects one lists it in `allowedProblems`.

export const test = base.extend<{
  allowedProblems: RegExp[]
  pageProblems: void
}>({
  allowedProblems: [[], { option: true }],
  pageProblems: [
    async ({ context, allowedProblems }, use) => {
      const problems: string[] = []
      context.on("weberror", (error) => {
        problems.push(`Uncaught: ${error.error().message}`)
      })
      context.on("console", (message) => {
        const text = message.text()
        const isProblem =
          message.type() === "error" ||
          (message.type() === "warning" && text.startsWith("[ui-sdk]"))
        if (isProblem) problems.push(`console.${message.type()}: ${text}`)
      })
      await use()
      const unexpected = problems.filter(
        (problem) => !allowedProblems.some((allowed) => allowed.test(problem))
      )
      expect(unexpected, "the page reported problems").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** A new chat's heading. */
export const greeting = (page: Page) =>
  page.getByRole("heading", { name: "What can I help with?" })

/** The thread's questions, oldest first. */
export const questions = (page: Page) =>
  page.getByRole("article", { name: "Your message" })

/** The thread's replies, oldest first. */
export const replies = (page: Page) =>
  page.getByRole("article", { name: "Reply" })

/** Checks that a new chat shows, signed in as `name`: the account row at
 *  the column's bottom names them. A phone hides the column (its drawer
 *  has its own row), so this finds the row hidden too. */
export async function expectSignedInAs(page: Page, name: string) {
  await expect(greeting(page)).toBeVisible()
  await expect(
    page
      .getByRole("navigation", { name: "Chats", includeHidden: true })
      .getByRole("button", { name, exact: true, includeHidden: true })
  ).toBeAttached()
}

export async function signInAsDev(page: Page) {
  await page.goto("/sign-in")
  await page.getByRole("button", { name: "Sign in as Dev" }).click()
  await expectSignedInAs(page, "Dev")
  // Typing before React hydrates is lost; the agent bridge sees the
  // controls once it has. The bridge itself may not be there yet, so check
  // for it first: a TypeError would end the wait instead of retrying it.
  await page.waitForFunction(
    () => "agent" in window && window.agent.snapshot().length > 0
  )
}

/** Signs in as the owner (Alec) by adding a passkey on /setup, through a
 *  virtual authenticator. e2e/seed.sql gives the owner 1,000 chats. */
export async function signInAsOwner(page: Page) {
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
  await page.goto(`/setup#${E2E_SETUP_CODE}`)
  await page.getByRole("button", { name: "Add a passkey" }).click()
  await expectSignedInAs(page, "Alec")
}

/** Records how far ahead of now each animation's start time is set: a
 *  sheet's open must never hold one ahead (ui-sdk #1085, patched in
 *  patches/@ui-sdk__core.patch), since WebKit draws from the first one. */
export async function recordStartTimes(page: Page) {
  await page.addInitScript(() => {
    const own = Object.getOwnPropertyDescriptor(
      Animation.prototype,
      "startTime"
    )
    const leads: number[] = []
    Object.assign(window, { startTimeLeads: leads })
    Object.defineProperty(Animation.prototype, "startTime", {
      get(this: Animation) {
        return own?.get?.call(this)
      },
      set(this: Animation, time: number | null) {
        if (time !== null) leads.push(time - performance.now())
        own?.set?.call(this, time)
      },
    })
  })
}

/** Checks that an open set its start times, none of them ahead of now. */
export async function expectNoHeldStart(page: Page) {
  const leads: number[] = await page.evaluate(() =>
    "startTimeLeads" in window && Array.isArray(window.startTimeLeads)
      ? window.startTimeLeads
      : []
  )
  expect(leads.length).toBeGreaterThan(0)
  expect(Math.max(...leads)).toBeLessThanOrEqual(0)
}

/** Taps `item` in a sheet once it has finished sliding up, where the
 *  item is, as a finger would: Playwright's own tap scrolls it into view
 *  first, and the sheet's scroller reads that as a swipe. */
export async function tapInSheet(sheet: Locator, item: Locator) {
  await expect
    .poll(() =>
      sheet.evaluate((el) => el.style.getPropertyValue("--drawer-progress"))
    )
    .toBe("1")
  const box = await item.boundingBox()
  if (box === null) throw new Error("The item has no box")
  await sheet
    .page()
    .touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}

/** Picks a model in the composer's picker, with a mouse: a popover (phones
 *  get a sheet, e2e/model.spec.ts). */
export async function pickModel(page: Page, name: string) {
  const picker = page.getByRole("combobox", { name: "Model" })
  await picker.click()
  await expect(page.locator('[data-slot="select-content"]')).toHaveAttribute(
    "data-presentation",
    "popover"
  )
  await page.getByRole("option", { name }).click()
  await expect(picker).toContainText(name)
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
  snapshot: () => { ref: string; label?: string; offPage?: boolean }[]
  act: (plan: {
    steps: { ref: string; action: string; args: unknown[] }[]
  }) => Promise<{ ok: boolean; error?: { message: string } }>
  query: (options: {
    within?: string
    text?: string
  }) => Promise<
    { error: string } | { label?: string; items: { value: unknown }[] }[]
  >
}
