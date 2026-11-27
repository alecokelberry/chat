import { randomUUID } from "node:crypto"
import {
  test as base,
  expect,
  type FileChooser,
  type Locator,
  type Page,
} from "@playwright/test"

import { BASE_URL, E2E_SETUP_CODE } from "../playwright.config"

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

/** The chat list's sidebar. */
export const sidebar = (page: Page) =>
  page.getByRole("navigation", { name: "Chats" })

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
 *  has its own row), so this finds the row hidden too, by its text (one
 *  or two initials, then the name): a hidden row has no accessible name. */
export async function expectSignedInAs(page: Page, name: string) {
  await expect(greeting(page)).toBeVisible()
  await expect(
    page
      .getByRole("navigation", { name: "Chats", includeHidden: true })
      .getByRole("button", { includeHidden: true })
      .filter({ hasText: new RegExp(`^\\s*\\S{0,2}\\s*${name}$`) })
  ).toBeAttached()
}

/** Waits until React has hydrated the page: a click or keystroke before
 *  that is lost. The agent bridge sees the controls once it has. The bridge
 *  itself may not be there yet, so check for it first: a TypeError would end
 *  the wait instead of retrying it. */
export async function hydrated(page: Page) {
  await page.waitForFunction(
    () => "agent" in window && window.agent.snapshot().length > 0
  )
}

/** Waits until the page is still: hydrated, two frames drawn, so effects,
 *  media query changes and new transitions have all run, and every running
 *  animation that can end has ended (not a scroll-driven one, like the
 *  chat list's fades, which never does). A check that something did NOT
 *  happen (no reload, no color change) goes after this, never after a
 *  fixed sleep: a sleep is a guess that passes on a fast machine and flakes
 *  on a slow one. A reload that starts meanwhile ends the evaluate, so it
 *  fails the test. */
export async function settled(page: Page) {
  await hydrated(page)
  await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    await frame()
    await frame()
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === "running" &&
            a.timeline instanceof DocumentTimeline &&
            a.effect?.getComputedTiming().endTime !== Infinity
        )
        .map((a) => a.finished.catch(() => undefined))
    )
  })
}

/** Signs in as this worker's own Dev (dev+N@chat.test, seeded like Dev
 *  in e2e/seed.sql), so tests in parallel never see each other's chats,
 *  and opens a new chat. It asks the dev sign-in endpoint directly, the
 *  way Playwright's auth docs sign in through an API: e2e/sign-in.spec.ts
 *  tests the button itself. */
export async function signInAsDev(page: Page) {
  const response = await page.request.post("/api/auth/dev-sign-in", {
    data: { as: String(test.info().parallelIndex) },
    // Better Auth refuses a POST without its own origin.
    headers: { origin: BASE_URL },
  })
  expect(response.ok(), await response.text()).toBe(true)
  await page.goto("/")
  await hydrated(page)
  await expectSignedInAs(page, "Dev")
}

/** Adds a virtual authenticator to the page, standing in for Touch ID. */
export async function addAuthenticator(page: Page) {
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

/** Signs in as the owner (Alec) by adding a passkey on /setup, through a
 *  virtual authenticator, which it returns. e2e/seed.sql gives the owner
 *  1,000 chats. */
export async function signInAsOwner(page: Page) {
  const authenticator = await addAuthenticator(page)
  await page.goto(`/setup#${E2E_SETUP_CODE}`)
  await hydrated(page)
  await page.getByRole("button", { name: "Add a passkey" }).click()
  await expectSignedInAs(page, "Alec Okelberry")
  await hydrated(page)
  return authenticator
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

/** A message nobody has sent before, so the mock's counts for it start
 *  fresh on a rerun. */
export const unique = (text: string) => `${text} ${randomUUID().slice(0, 8)}`

/** Sends a message the way a person does: once the last reply is over. The
 *  composer ignores Enter while a reply streams (Send is Stop then), and a
 *  reply's last word shows before its stream has ended, so on a slow
 *  runner a message typed right after "Done." was dropped, leaving the
 *  text in the box. So it waits for Stop to go, and checks the box emptied,
 *  which is what a sent message does. */
export async function send(page: Page, text: string) {
  const message = page.getByRole("textbox", { name: "Message" })
  // Exact: "Search stopped", a stopped search's step, is a button too.
  await expect(
    page.getByRole("button", { name: "Stop", exact: true })
  ).toHaveCount(0)
  await message.fill(text)
  await page.keyboard.press("Enter")
  await expect(message).toHaveValue("")
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
  query: (options: { within?: string; text?: string }) => Promise<
    | { error: string }
    | {
        ref: string
        label?: string
        offPage?: boolean
        items: { value: unknown }[]
      }[]
  >
}

/** Attaches files with + › Add photos & files. */
export async function pick(
  page: Page,
  files: Parameters<FileChooser["setFiles"]>[0]
) {
  await page.getByRole("button", { name: "Attach" }).click()
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("menuitem", { name: "Add photos & files" }).click()
  await (await chooser).setFiles(files)
}
