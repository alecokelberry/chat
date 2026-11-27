import type { Page } from "@playwright/test"

import {
  expect,
  expectNoHeldStart,
  greeting,
  recordStartTimes,
  send,
  settled,
  signInAsDev,
  signInAsOwner,
  tapInSheet,
  test,
} from "./session"

// The chat list (src/components/chat/chat-sidebar.tsx, src/lib/chat) on the
// mock model: a send puts its chat at the top, the first reply names it
// (the mock always says TITLE, src/lib/ai/mock.ts), rows are grouped by
// the browser's own day, and on a phone the list is a drawer. Other tests
// make chats as Dev at the same time, so these check their own rows, not
// the whole list. Rows named "Seeded …" come from e2e/seed.sql.

const TITLE = "Talking to the mock model"

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })

test.describe.configure({ mode: "serial" })

test("a new chat shows at the top as New chat, then takes its title", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Name me (paced)")
  const open = sidebar(page).locator("a[aria-current=page]")
  // While the reply streams, the chat is listed but not yet named.
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(open).toHaveText("New chat")
  await expect(
    sidebar(page).getByRole("region", { name: "Today" })
  ).toContainText("New chat")

  await expect(open).toHaveText(TITLE)
  await page.reload()
  await expect(open).toHaveText(TITLE)
})

test("a chat moves up when it gets a message", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "First of two")
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  const first = page.url()
  await sidebar(page)
    .getByRole("link", { name: "New Chat", exact: true })
    .click()
  await expect(greeting(page)).toBeVisible()
  await send(page, "Second of two")
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  const second = page.url()
  const order = async () => {
    const hrefs = await sidebar(page)
      .getByRole("listitem")
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
    const path = (url: string) => new URL(url).pathname
    return [hrefs.indexOf(path(first)), hrefs.indexOf(path(second))]
  }
  await expect.poll(order).toEqual([expect.any(Number), expect.any(Number)])
  const [a, b] = await order()
  expect(b).toBeLessThan(a ?? -1)

  // Opening the first and sending moves it back above the second.
  await page.goto(first)
  await expect(page.getByRole("article", { name: "Reply" })).toContainText(
    "Done."
  )
  await send(page, "Back to the first")
  await expect
    .poll(async () => {
      const [x = -1, y = -1] = await order()
      return x < y
    })
    .toBe(true)
})

test.describe("in Auckland", () => {
  test.use({ timezoneId: "Pacific/Auckland" })

  test("groups follow the browser's own day", async ({ page }) => {
    // Mar 10, 10:00 in Auckland (UTC+13), still Mar 9 in UTC; one seeded
    // chat is from 23:30 the night before there, still Mar 9 in UTC.
    const now = Date.UTC(2026, 2, 9, 21, 0)
    await page.clock.setFixedTime(now)
    await signInAsDev(page)
    const group = (name: string) =>
      sidebar(page).getByRole("region", { name, exact: true })
    await expect(group("Today")).toContainText("Seeded just after midnight")
    await expect(group("Yesterday")).toContainText("Seeded late last night")
    await expect(group("Previous 7 days")).toContainText(
      "Seeded three days ago"
    )
    await expect(group("Older")).toContainText("Seeded a month ago")
    const headings = await sidebar(page).getByRole("heading").allInnerTexts()
    expect(headings).toEqual([
      "Pinned",
      "Today",
      "Yesterday",
      "Previous 7 days",
      "Older",
    ])
  })
})

// The pin is seeded, so the first load reads it from the database the
// way a reload does. The Auckland test above checks it sits above Today.
test("a pinned chat sits under Pinned, at the top", async ({ page }) => {
  await signInAsDev(page)
  const pinned = sidebar(page).getByRole("region", { name: "Pinned" })
  await expect(pinned).toContainText("Seeded pinned")
  await expect(sidebar(page).getByRole("heading").first()).toHaveText("Pinned")
  // Only there: pinned chats leave their day's group.
  await expect(
    sidebar(page).getByRole("link", { name: "Seeded pinned" })
  ).toHaveCount(1)
})

// The row menu (src/components/chat/chat-actions.tsx): each test starts
// its own chat and renames it to a name of its own, since other tests make
// chats called TITLE at the same time.

/** Starts a chat and waits for the model to name it. */
async function startChat(page: Page, text: string) {
  await signInAsDev(page)
  await send(page, text)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE)
}

/** The open chat's row: its link and its menu's trigger. */
const openRow = (page: Page) =>
  sidebar(page)
    .getByRole("listitem")
    .filter({ has: page.locator("a[aria-current=page]") })

const rowMenu = (page: Page) =>
  openRow(page).getByRole("button", { name: /^Actions for / })

const menu = (page: Page) => page.getByRole("menu")

const titleField = (page: Page) =>
  page.getByRole("textbox", { name: "Chat title" })

const unique = (name: string) =>
  `${name} ${Math.random().toString(36).slice(2, 8)}`

test("Rename in the row saves on Enter and ✓, cancels on Escape and ✕", async ({
  page,
}) => {
  await startChat(page, "Rename me")
  const pill = page.getByRole("heading", { level: 1 })

  // Enter saves; the field starts with the title, all selected.
  const first = unique("Renamed")
  await openRow(page).hover()
  await rowMenu(page).click()
  await menu(page).getByRole("menuitem", { name: "Rename" }).click()
  await expect(titleField(page)).toBeFocused()
  await expect(titleField(page)).toHaveValue(TITLE)
  await page.keyboard.type(first)
  await page.keyboard.press("Enter")
  await expect(titleField(page)).toBeHidden()
  await expect(openRow(page).getByRole("link")).toHaveText(first)
  await expect(pill).toHaveText(first)
  // Focus goes back to the row's …, not to the page.
  await expect(rowMenu(page)).toBeFocused()

  // Escape and ✕ cancel.
  await rowMenu(page).click()
  await menu(page).getByRole("menuitem", { name: "Rename" }).click()
  await page.keyboard.type("Not this")
  await page.keyboard.press("Escape")
  await expect(titleField(page)).toBeHidden()
  await expect(openRow(page).getByRole("link")).toHaveText(first)
  await rowMenu(page).click()
  await menu(page).getByRole("menuitem", { name: "Rename" }).click()
  await page.keyboard.type("Nor this")
  await sidebar(page).getByRole("button", { name: "Cancel" }).click()
  await expect(openRow(page).getByRole("link")).toHaveText(first)

  // ✓ saves, and the name survives a reload and the next reply: Lightning
  // names only a chat without a title.
  const second = unique("Renamed again")
  await rowMenu(page).click()
  await menu(page).getByRole("menuitem", { name: "Rename" }).click()
  await page.keyboard.type(second)
  await sidebar(page).getByRole("button", { name: "Save" }).click()
  await expect(openRow(page).getByRole("link")).toHaveText(second)
  await send(page, "Keep my name")
  await expect(
    page.getByRole("article", { name: "Reply" }).nth(1)
  ).toContainText("Done.")
  await page.reload()
  await expect(openRow(page).getByRole("link")).toHaveText(second)
  await expect(pill).toHaveText(second)
})

test("Pin moves a chat to Pinned and Unpin moves it back", async ({ page }) => {
  await startChat(page, "Pin me")
  const pinned = sidebar(page).getByRole("region", { name: "Pinned" })
  const today = sidebar(page).getByRole("region", { name: "Today" })
  const link = sidebar(page).locator("a[aria-current=page]")

  // The row moves at once, before the write lands: reload only after it.
  const written = () =>
    page.waitForResponse(
      (response) =>
        response.url().includes("/_serverFn/") &&
        response.request().method() === "POST"
    )
  await rowMenu(page).click()
  let pinWritten = written()
  await menu(page).getByRole("menuitem", { name: "Pin" }).click()
  await expect(pinned.locator("a[aria-current=page]")).toBeVisible()
  await pinWritten
  await page.reload()
  await expect(pinned.locator("a[aria-current=page]")).toBeVisible()

  await openRow(page).hover()
  await rowMenu(page).click()
  pinWritten = written()
  await menu(page).getByRole("menuitem", { name: "Unpin" }).click()
  await expect(today.locator("a[aria-current=page]")).toBeVisible()
  await pinWritten
  await page.reload()
  await expect(today.locator("a[aria-current=page]")).toBeVisible()
  await expect(link).toHaveCount(1)
})

// A list load already on its way when the pin is written comes back
// without it. The row must stay pinned through that load, not go back to
// Today for a moment and then return; and the … that had focus is built
// again with the row, so the new one takes focus.
test("a pin stays put when a stale list load lands", async ({ page }) => {
  await startChat(page, "Pin through a stale load")
  // Each server function's last answer, by its address: a stale load
  // replays the list's own earlier answer, never another function's (which
  // the list can't read: "find is not a function").
  const latest = new Map<
    string,
    { body: Buffer; headers: Record<string, string> }
  >()
  let stale = false
  const replayed = new Set<string>()
  await page.route(/\/_serverFn\//, async (route) => {
    if (route.request().method() !== "GET") return route.continue()
    const url = route.request().url()
    const before = latest.get(url)
    if (stale && before !== undefined && !replayed.has(url)) {
      replayed.add(url)
      return route.fulfill({ ...before, status: 200 })
    }
    const response = await route.fetch()
    latest.set(url, {
      body: await response.body(),
      headers: response.headers(),
    })
    return route.fulfill({ response })
  })
  // A load of the list from before the pin.
  await sidebar(page)
    .getByRole("link", { name: "New Chat", exact: true })
    .click()
  await expect.poll(() => latest.size).toBeGreaterThan(0)
  await page.goBack()
  await expect(openRow(page)).toBeVisible()

  await page.evaluate(() => {
    const seen: string[] = []
    Object.assign(window, { seen })
    const look = () => {
      const row = document.querySelector("nav a[aria-current=page]")
      const group = row?.closest("section")?.querySelector("h2")?.textContent
      if (typeof group === "string" && seen.at(-1) !== group) seen.push(group)
      requestAnimationFrame(look)
    }
    look()
  })
  stale = true
  await openRow(page).hover()
  await rowMenu(page).click()
  await menu(page).getByRole("menuitem", { name: "Pin" }).click()
  await expect(
    sidebar(page)
      .getByRole("region", { name: "Pinned" })
      .locator("a[aria-current=page]")
  ).toBeVisible()
  await expect(rowMenu(page)).toBeFocused()
  await settled(page)
  const seen = await page.evaluate(() => Reflect.get(window, "seen"))
  expect(seen).toEqual(["Today", "Pinned"])

  // Back where it was: pins sit at the top, where other tests look.
  await rowMenu(page).click()
  await menu(page).getByRole("menuitem", { name: "Unpin" }).click()
  await expect(
    sidebar(page)
      .getByRole("region", { name: "Today" })
      .locator("a[aria-current=page]")
  ).toBeVisible()
  // No list load still being fetched through the route when the test ends.
  await page.unrouteAll({ behavior: "ignoreErrors" })
})

// The write is checked against the signed-in user: here the request names
// a chat that isn't theirs, so it fails, the row goes back and a toast
// says so.
test("a rename that fails goes back and says so", async ({ page }) => {
  await startChat(page, "Fail my rename")
  const id = new URL(page.url()).pathname.split("/").at(-1) ?? ""
  await page.route(/\/_serverFn\//, (route) =>
    route.request().method() === "POST"
      ? route.continue({
          postData: route
            .request()
            .postData()
            ?.replace(id, "00000000-0000-4000-8000-00000000dead"),
        })
      : route.continue()
  )
  await rowMenu(page).click()
  await menu(page).getByRole("menuitem", { name: "Rename" }).click()
  await page.keyboard.type(unique("Not mine"))
  await page.keyboard.press("Enter")
  await expect(page.getByText("Couldn't rename the chat")).toBeVisible()
  await expect(openRow(page).getByRole("link")).toHaveText(TITLE)
})

test("Open in new tab opens the chat in a new tab", async ({ page }) => {
  await startChat(page, "Open me twice")
  const path = new URL(page.url()).pathname
  await rowMenu(page).click()
  const [tab] = await Promise.all([
    page.context().waitForEvent("page"),
    menu(page).getByRole("menuitem", { name: "Open in new tab" }).click(),
  ])
  await expect(tab).toHaveURL(new RegExp(`${path}$`))
})

test("the header's … menu pins and renames in the pill", async ({ page }) => {
  await startChat(page, "Header menu")
  const actions = page.getByRole("button", { name: "Chat actions" })
  const pill = page.getByRole("heading", { level: 1 })

  await actions.click()
  await menu(page).getByRole("menuitem", { name: "Rename" }).click()
  await expect(titleField(page)).toBeFocused()
  await expect(titleField(page)).toHaveValue(TITLE)
  const name = unique("From the header")
  await page.keyboard.type(name)
  await page.keyboard.press("Enter")
  await expect(pill).toHaveText(name)
  await expect(openRow(page).getByRole("link")).toHaveText(name)
  await expect(actions).toBeFocused()

  await actions.click()
  await menu(page).getByRole("menuitem", { name: "Pin" }).click()
  await expect(
    sidebar(page)
      .getByRole("region", { name: "Pinned" })
      .locator("a[aria-current=page]")
  ).toBeVisible()
  await actions.click()
  await expect(
    menu(page).getByRole("menuitem", { name: "Unpin" })
  ).toBeVisible()
  await page.keyboard.press("Escape")
})

// Delete (chat-list.tsx): the row goes at once and a toast offers Undo;
// the chat is deleted for good only once the toast closes without it.
/** The toasts showing, not the ones on their way out. */
const toasts = (page: Page) =>
  page
    .getByRole("region", { name: "Notifications" })
    .locator("[data-slot=toast]:not([data-ending-style])")

const rowFor = (page: Page, path: string) =>
  sidebar(page).locator(`a[href="${path}"]`)

/** Deletes the chat at `path` from its row, for good: each test that
 *  makes a chat it keeps deletes it, since the agent test sees only the
 *  first 100 controls. */
async function deleteForGood(page: Page, path: string) {
  await rowFor(page, path).hover()
  await sidebar(page)
    .getByRole("listitem")
    .filter({ has: page.locator(`a[href="${path}"]`) })
    .getByRole("button", { name: /^Actions for / })
    .click()
  await menu(page).getByRole("menuitem", { name: "Delete" }).click()
  await expect(toasts(page)).toContainText("Chat deleted")
  // The row's … went with it, so focus goes to the page.
  await expect(page.locator("#main")).toBeFocused()
  await page.evaluate(() => window.toast.dismiss())
  await expect(toasts(page)).toHaveCount(0)
  await page.reload()
  await expect(rowFor(page, path)).toHaveCount(0)
}

/** What the chat's agent holds, as the browser loads it: how many messages,
 *  or -1 while the agent is being wiped (it answers 500 until it is gone). */
const savedMessages = (page: Page, id: string) =>
  page.evaluate(async (id) => {
    const response = await fetch(`/api/chats/${id}/get-messages`)
    if (!response.ok) return -1
    const messages: unknown[] = await response.json()
    return messages.length
  }, id)

test("Delete hides the open chat at once, and Undo puts it back", async ({
  page,
}) => {
  await startChat(page, "Delete then undo")
  const path = new URL(page.url()).pathname

  await openRow(page).hover()
  await rowMenu(page).click()
  await menu(page).getByRole("menuitem", { name: "Delete" }).click()
  await expect(rowFor(page, path)).toHaveCount(0)
  // The open chat was the one deleted: a new chat, with focus on the page.
  await expect(page).toHaveURL(/\/$/)
  await expect(greeting(page)).toBeVisible()
  await expect(page.locator("#main")).toBeFocused()
  await expect(toasts(page)).toContainText("Chat deleted")

  await toasts(page).getByRole("button", { name: "Undo" }).click()
  await expect(toasts(page)).toHaveCount(0)
  await expect(rowFor(page, path)).toHaveText(TITLE)
  await page.reload()
  await expect(rowFor(page, path)).toHaveText(TITLE)
  await deleteForGood(page, path)
})

// The poll can catch the agent mid-wipe, when it answers 500.
test.describe("a chat wiped for good", () => {
  test.use({ allowedProblems: [/status of 500/] })

  test("once the toast closes, a deleted chat and its messages are gone", async ({
    page,
  }) => {
    await startChat(page, "Delete me for good")
    const path = new URL(page.url()).pathname
    const id = path.split("/").at(-1) ?? ""
    expect(await savedMessages(page, id)).toBe(2)

    // From the header's … this time.
    await page.getByRole("button", { name: "Chat actions" }).click()
    await menu(page).getByRole("menuitem", { name: "Delete" }).click()
    await expect(rowFor(page, path)).toHaveCount(0)
    await expect(toasts(page)).toContainText("Chat deleted")
    // As if it timed out, without the wait. The delete succeeds, so no
    // toast says it failed: the agent's wipe once beat its own answer.
    const deleted = page.waitForResponse(
      (response) =>
        response.url().includes("/_serverFn/") &&
        response.request().method() === "POST"
    )
    await page.evaluate(() => window.toast.dismiss())
    expect((await deleted).ok()).toBe(true)
    // The wipe waits until the delete has answered: run at once, it can
    // end the agent before its answer leaves, and the delete then fails.
    expect(await savedMessages(page, id)).toBe(2)
    await expect(toasts(page)).toHaveCount(0)

    await expect.poll(() => savedMessages(page, id)).toBe(0)
    await page.reload()
    await expect(greeting(page)).toBeVisible()
    await expect(rowFor(page, path)).toHaveCount(0)
  })
})

// The delete is checked against the signed-in user: here the request names
// a chat that isn't theirs, so it fails, the row comes back and a toast
// says so.
test("a delete that fails brings the chat back and says so", async ({
  page,
}) => {
  await startChat(page, "Fail my delete")
  const path = new URL(page.url()).pathname
  const id = path.split("/").at(-1) ?? ""
  await page.route(/\/_serverFn\//, (route) =>
    route.request().method() === "POST"
      ? route.continue({
          postData: route
            .request()
            .postData()
            ?.replace(id, "00000000-0000-4000-8000-00000000dead"),
        })
      : route.continue()
  )
  await rowMenu(page).click()
  await menu(page).getByRole("menuitem", { name: "Delete" }).click()
  await expect(rowFor(page, path)).toHaveCount(0)
  await page.evaluate(() => window.toast.dismiss())
  await expect(page.getByText("Couldn't delete the chat")).toBeVisible()
  await expect(rowFor(page, path)).toHaveText(TITLE)
  expect(await savedMessages(page, id)).toBe(2)
  await page.unrouteAll()
  await page.evaluate(() => window.toast.dismiss())
  await deleteForGood(page, path)
})

// ui-sdk's agent test: Delete is marked as a person's to press, so an
// agent's press is refused and the chat stays.
test("an agent can't delete a chat", async ({ page }) => {
  await signInAsDev(page)
  const row = sidebar(page).getByRole("link", { name: "Seeded for an agent" })
  await expect(row).toBeVisible()
  const result = await page.evaluate(async () => {
    // Pressing a menu's item by its text opens the menu to find it.
    const deleted = await window.agent.act({
      steps: [
        {
          ref: "Actions for Seeded for an agent",
          action: "press",
          args: ["Delete"],
        },
      ],
    })
    return deleted.error?.message ?? ""
  })
  expect(result).toMatch(/Needs a person: "Delete this chat"/)
  await expect(row).toBeVisible()
  await expect(toasts(page)).toHaveCount(0)
})

// ui-sdk's agent test: each row's menu is a named control an agent can
// open, and its actions are named.
test("an agent can open a row's menu", async ({ page }) => {
  await signInAsDev(page)
  await expect(
    sidebar(page).getByRole("link", { name: "Seeded for an agent" })
  ).toBeVisible()
  const opened = await page.evaluate(async () => {
    const result = await window.agent.act({
      steps: [
        { ref: "Actions for Seeded for an agent", action: "press", args: [] },
      ],
    })
    return result.ok
  })
  expect(opened).toBe(true)
  for (const name of ["Pin", "Rename", "Open in new tab"])
    await expect(menu(page).getByRole("menuitem", { name })).toBeVisible()
})

test("holds up with 1,000 chats and worst-case titles", async ({ page }) => {
  const long =
    "An unreasonably long chat title that goes on and on and on and on and on and on and on and on"
  await page.setViewportSize({ width: 1440, height: 900 })
  await signInAsOwner(page)
  const rows = sidebar(page).getByRole("listitem")
  await expect(rows.filter({ hasText: "Seeded chat 996" })).toHaveCount(1)
  expect(await rows.count()).toBeGreaterThanOrEqual(1000)

  // Long titles stay on one 40px row inside the column.
  const row = sidebar(page).getByRole("link", { name: long })
  const box = await row.boundingBox()
  const column = await sidebar(page).boundingBox()
  expect(box?.height).toBe(40)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    (column?.x ?? 0) + (column?.width ?? 0)
  )
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
  expect(wide).toBe(false)

  // The last row is reachable, and opening it works.
  const last = sidebar(page).getByRole("link", { name: "Seeded chat 996" })
  await last.scrollIntoViewIfNeeded()
  await last.click()
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/)
  await expect(last).toHaveAttribute("aria-current", "page")

  // Search lists the recent 50 and ranks all 1,000 (only the rows in view
  // render), so the oldest is a few letters away.
  await page.keyboard.press("ControlOrMeta+k")
  const search = page.getByRole("dialog", { name: "Search" })
  await expect(search.getByRole("option")).toHaveCount(50)
  await page
    .getByRole("combobox", { name: "Search chats" })
    .fill("seeded chat 995")
  await expect(search.getByRole("option").first()).toHaveText("Seeded chat 995")
  expect(await search.getByRole("option").count()).toBeLessThan(60)

  // Dev's words (e2e/seed.sql) are never the owner's to find.
  const searched = page.waitForResponse((response) =>
    decodeURIComponent(response.url()).includes("zanzibarite")
  )
  await page.getByRole("combobox", { name: "Search chats" }).fill("zanzibarite")
  expect((await searched).ok()).toBe(true)
  await expect(search).toContainText("No chats match “zanzibarite”")
})

// ui-sdk's agent test: rows are controls an agent can find and press. A
// row's title is also in its menu's name ("Actions for …"), and a label
// matches every label holding its words, so the agent picks the row by
// its ref. It finds the row by query: the snapshot lists only the first
// 100 controls, and other tests' chats can fill those.
test("an agent can open a chat from the list", async ({ page }) => {
  await signInAsDev(page)
  await expect(
    sidebar(page).getByRole("link", { name: "Seeded for an agent" })
  ).toBeVisible()
  // The snapshot stops at 100 components, and the list grows with every
  // chat the other tests make, so the agent asks for the row it wants.
  const result = await page.evaluate(async () => {
    const { agent } = window
    const labels = agent
      .snapshot()
      .filter((entry) => entry.offPage !== true && entry.ref !== "more")
      .map((entry) => entry.label)
    const found = await agent.query({ text: "Seeded for an agent" })
    const matches = "error" in found ? [] : found
    const row = matches.find((entry) => entry.label === "Seeded for an agent")
    const opened = await agent.act({
      steps: [{ ref: row?.ref ?? "", action: "press", args: [] }],
    })
    return {
      labels,
      found: matches.map((entry) => entry.label),
      opened: opened.ok,
    }
  })
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.labels).toContain("New Chat")
  expect(result.found).toContain("Actions for Seeded for an agent")
  expect(result.opened).toBe(true)
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/)
  await expect(
    sidebar(page).getByRole("link", { name: "Seeded for an agent" })
  ).toHaveAttribute("aria-current", "page")
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  // A tap on the sidebar button before the page's scripts have run isn't
  // lost: the drawer opens once they have.
  test("a tap before the page hydrates still opens the drawer", async ({
    page,
  }) => {
    await signInAsDev(page)
    let release = () => {}
    const scripts = new Promise<void>((resolve) => (release = resolve))
    await page.route(/\.js(\?|$)/, async (route) => {
      await scripts
      await route.continue()
    })
    await page.goto("/", { waitUntil: "commit" })
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    release()
    await expect(page.getByRole("dialog", { name: "Chats" })).toBeVisible()
  })

  test("the list is a drawer from the start edge", async ({ page }) => {
    await signInAsDev(page)
    await send(page, "From my phone")
    await expect(page.getByRole("article", { name: "Reply" })).toContainText(
      "Done."
    )
    await expect(sidebar(page)).toBeHidden()

    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    await expect(drawer).toBeVisible()
    // It slides in from the start edge and rests against it.
    await expect.poll(async () => (await drawer.boundingBox())?.x).toBe(0)
    await expect(drawer.locator("a[aria-current=page]")).toHaveText(TITLE)

    // Picking New Chat goes there and closes the drawer.
    await drawer.getByRole("link", { name: "New Chat", exact: true }).tap()
    await expect(page).toHaveURL(/\/$/)
    await expect(drawer).toBeHidden()
  })

  // Touch has no hover: every row's … shows, its menu is a sheet (the
  // row's wash alone marks it, with no second square on the …), and
  // Rename edits the row without closing the drawer.
  test("a row's menu works in the drawer", async ({ page }) => {
    await startChat(page, "Rename from my phone")
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    const row = drawer
      .getByRole("listitem")
      .filter({ has: page.locator("a[aria-current=page]") })
    await row.getByRole("button", { name: /^Actions for / }).tap()
    const sheet = page.locator('[data-slot="menu-content"]')
    await expect(sheet).toHaveAttribute("data-presentation", "sheet")
    const opener = row.getByRole("button", { name: /^Actions for / })
    await expect(opener).toHaveAttribute("data-open")
    await expect(opener).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await tapInSheet(sheet, page.getByRole("menuitem", { name: "Rename" }))
    // The keyboard's Return reads Done.
    await expect(titleField(page)).toHaveAttribute("enterkeyhint", "done")
    // Escape cancels the rename, not the drawer, and focus goes back to
    // the row's ….
    const actions = row.getByRole("button", { name: /^Actions for / })
    await page.keyboard.press("Escape")
    await expect(titleField(page)).toBeHidden()
    await expect(drawer).toBeVisible()
    await expect(actions).toBeFocused()
    await expect(row.getByRole("link")).toHaveText(TITLE)

    await actions.tap()
    await tapInSheet(sheet, page.getByRole("menuitem", { name: "Rename" }))
    // A long, non-Latin title stays one row inside the drawer.
    const name = unique(
      "名前を変えたとても長いチャットのタイトルがここに続きます"
    )
    await titleField(page).fill(name)
    await page.keyboard.press("Enter")
    await expect(row.getByRole("link")).toHaveText(name)
    await expect(drawer).toBeVisible()
    expect((await row.getByRole("link").boundingBox())?.height).toBe(40)
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(wide).toBe(false)
  })

  // A long list opens with a screenful and fills in once the drawer has
  // settled, so mounting 1,000 rows doesn't freeze the slide.
  test("a long list fills in once the drawer has opened", async ({ page }) => {
    await signInAsOwner(page)
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    await expect(
      drawer.getByRole("link", { name: "X", exact: true })
    ).toBeVisible()
    await expect(
      drawer.getByRole("link", { name: "Seeded chat 996" })
    ).toHaveCount(1)
    expect(await drawer.getByRole("listitem").count()).toBeGreaterThanOrEqual(
      1000
    )
  })

  // The drawer's slide starts on its first frame, with no start time held
  // ahead (ui-sdk #1085: WebKit kept it, so an iPhone showed nothing for a
  // second).
  test("the drawer's slide starts at once", async ({ page }) => {
    await recordStartTimes(page)
    await signInAsDev(page)
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    await expect.poll(async () => (await drawer.boundingBox())?.x).toBe(0)
    await expectNoHeldStart(page)
  })

  // ui-sdk's agent test: the drawer's trigger is named and an agent can
  // open it.
  test("an agent can open the drawer", async ({ page }) => {
    await signInAsDev(page)
    const result = await page.evaluate(async () => {
      const { agent } = window
      const labels = agent
        .snapshot()
        .filter((entry) => entry.offPage !== true && entry.ref !== "more")
        .map((entry) => entry.label)
      const opened = await agent.act({
        steps: [{ ref: "Open sidebar", action: "press", args: [] }],
      })
      return { labels, opened: opened.ok }
    })
    expect(result.labels.every(Boolean)).toBe(true)
    expect(result.labels).toEqual(expect.arrayContaining(["Open sidebar"]))
    expect(result.opened).toBe(true)
    await expect(page.getByRole("dialog", { name: "Chats" })).toBeVisible()
  })
})
