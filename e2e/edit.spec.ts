import { readFileSync } from "node:fs"

import type { Page } from "@playwright/test"

import {
  expect,
  pick,
  pickModel,
  questions,
  replies,
  send,
  signInAsDev,
  test,
} from "./session"

// Editing a sent question (src/components/chat/question.tsx) on the mock
// model: Edit turns the bubble into a field, and sending it replaces the
// question and everything after it, then the reply streams again on the
// model the picker shows. Escape and Cancel change nothing, and Edit waits
// while a reply streams. A question's attachments come along: ✕ takes
// one out, Add files adds more, and Cancel puts them back.

const field = (page: Page) =>
  page.getByRole("textbox", { name: "Edit question" })

/** Presses Edit under the question at `index`. */
async function edit(page: Page, index: number) {
  const actions = page
    .getByRole("toolbar", { name: "Question actions" })
    .nth(index)
  await questions(page).nth(index).hover()
  await actions.getByRole("button", { name: "Edit message" }).click()
  await expect(field(page)).toBeFocused()
}

/** Two questions, each answered. */
async function twoAnswered(page: Page) {
  await signInAsDev(page)
  await send(page, "First question")
  await expect(replies(page)).toHaveText([/Done\.$/])
  // The last word arrives a moment before the reply ends; until it ends,
  // Enter doesn't send.
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  await send(page, "Second question")
  await expect(replies(page)).toHaveText([/Done\.$/, /Done\.$/])
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
}

test("an edited question replaces it and everything after, after a reload too", async ({
  page,
}) => {
  await twoAnswered(page)
  // The reply comes from the model the picker shows now.
  await pickModel(page, "Nano Omni")

  await edit(page, 0)
  await expect(field(page)).toHaveValue("First question")
  await field(page).fill("Edited question (paced)")
  await page.keyboard.press("Enter")

  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(questions(page)).toHaveText(["Edited question (paced)"])
  await expect(replies(page)).toHaveText([/nano-omni.*Done\.$/])
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  // Gone from the chat, not only from the screen.
  await page.reload()
  await expect(questions(page)).toHaveText(["Edited question (paced)"])
  await expect(replies(page)).toHaveText([/nano-omni.*Done\.$/])
})

test("Escape, Cancel and an unchanged question leave the chat as it was", async ({
  page,
}) => {
  await twoAnswered(page)

  await edit(page, 1)
  await field(page).fill("Never sent")
  await page.keyboard.press("Escape")
  await expect(field(page)).toHaveCount(0)
  // Focus goes back to Edit.
  await expect(
    page
      .getByRole("toolbar", { name: "Question actions" })
      .nth(1)
      .getByRole("button", { name: "Edit message" })
  ).toBeFocused()

  await edit(page, 1)
  await expect(field(page)).toHaveValue("Second question")
  await field(page).fill("Never sent either")
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(field(page)).toHaveCount(0)

  // Unchanged, Enter just closes the field: nothing is sent.
  await edit(page, 0)
  await page.keyboard.press("Enter")
  await expect(field(page)).toHaveCount(0)

  await expect(questions(page)).toHaveText([
    "First question",
    "Second question",
  ])
  await expect(replies(page)).toHaveCount(2)
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
})

test("Edit waits while a reply streams", async ({ page }) => {
  await signInAsDev(page)
  await send(page, "Hello (paced)")
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Edit message" })
  ).toBeDisabled()
  await expect(replies(page)).toContainText("Done.")
  await expect(page.getByRole("button", { name: "Edit message" })).toBeEnabled()
})

test("an open edit waits for a reply another tab started", async ({
  page,
  context,
}) => {
  await signInAsDev(page)
  await send(page, "Hello")
  await expect(replies(page)).toContainText("Done.")
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  await edit(page, 0)
  await field(page).fill("Edited while busy")

  const other = await context.newPage()
  await other.goto(page.url())
  await send(other, "From the other tab (paced)")
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()

  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()
  await field(page).press("Enter")
  // Nothing sent: the field stays open with its words.
  await expect(field(page)).toHaveValue("Edited while busy")
  await expect(replies(page).last()).toContainText("Done.")
  await expect(questions(page)).toHaveCount(2)
})

// ui-sdk's agent test: a question's actions are named, an agent can open
// the field and write in it, and Save, which sends, needs a person.
test("an agent can edit a question, and sending it needs a person", async ({
  page,
}) => {
  await signInAsDev(page)
  await send(page, "Hello")
  await expect(replies(page)).toContainText("Done.")
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
  const result = await page.evaluate(async () => {
    const { agent } = window
    const opened = await agent.act({
      steps: [
        { ref: "Edit message", action: "press", args: [] },
        { ref: "Edit question", action: "setValue", args: ["From an agent"] },
      ],
    })
    const labels = agent
      .snapshot()
      .filter((entry) => entry.offPage !== true && entry.ref !== "more")
      .map((entry) => entry.label)
    // Found by query, not in the snapshot: it lists only the first 100
    // components, and the chat list can fill them.
    const shown: string[] = []
    for (const wanted of ["Edit question", "Cancel", "Save"]) {
      const found = await agent.query({ text: wanted })
      if (
        !("error" in found) &&
        found.some((entry) => entry.label === wanted && entry.offPage !== true)
      )
        shown.push(wanted)
    }
    const saved = await agent.act({
      steps: [{ ref: "Save", action: "press", args: [] }],
    })
    return { opened: opened.ok, labels, shown, saved: saved.ok }
  })
  expect(result.opened).toBe(true)
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.shown).toEqual(["Edit question", "Cancel", "Save"])
  expect(result.saved).toBe(false)
  await expect(field(page)).toHaveValue("From an agent")
  await expect(questions(page)).toHaveText(["Hello"])
})

const NOTES = {
  name: "notes.pdf",
  mimeType: "application/pdf",
  buffer: readFileSync("e2e/fixtures/notes.pdf"),
}
const SMALL = {
  name: "small.jpg",
  mimeType: "image/jpeg",
  buffer: readFileSync("e2e/fixtures/small.jpg"),
}

/** The edited question's tiles. */
const editTiles = (page: Page) =>
  page.getByRole("list", { name: "Attached files" }).getByRole("listitem")

/** A question with an image and a PDF, answered. */
async function withAttachments(page: Page) {
  await signInAsDev(page)
  await pick(page, [SMALL, NOTES])
  await expect(
    page.getByRole("list", { name: "Attached files" }).locator("img")
  ).toHaveCount(1)
  await expect(
    page
      .getByRole("list", { name: "Attached files" })
      .getByText("PDF", { exact: true })
  ).toBeVisible()
  await send(page, "What are these?")
  await expect(replies(page)).toHaveText(
    [/Saw 1 image\. Read notes\.pdf\. .*Done\.$/],
    { timeout: 15_000 }
  )
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()
}

test("editing only the words keeps the attachments, and Retry resends them", async ({
  page,
}) => {
  await withAttachments(page)
  await edit(page, 0)
  await expect(editTiles(page)).toHaveCount(2)
  await field(page).fill("And now?")
  await page.keyboard.press("Enter")

  await expect(questions(page)).toHaveText(["And now?"])
  await expect(replies(page)).toHaveText(
    [/Saw 1 image\. Read notes\.pdf\. .*Done\.$/],
    { timeout: 15_000 }
  )
  await expect(
    page.getByRole("button", { name: "View small.jpg" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Retry" }).click()
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible()
  await expect(replies(page)).toHaveText(
    [/Saw 1 image\. Read notes\.pdf\. .*Done\.$/],
    { timeout: 15_000 }
  )
})

test("an edit can take an attachment out and add one", async ({ page }) => {
  await withAttachments(page)
  await edit(page, 0)
  await page.getByRole("button", { name: "Remove small.jpg" }).click()
  await expect(editTiles(page)).toHaveCount(1)
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Add files" }).click()
  await (
    await chooser
  ).setFiles({
    name: "plan.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("Hike at dawn."),
  })
  await expect(editTiles(page)).toHaveCount(2)
  await page.getByRole("button", { name: "Save" }).click()

  await expect(replies(page)).toHaveText(
    [/^(?!.*Saw).*Read notes\.pdf\. Read plan\.md\. .*Done\.$/],
    { timeout: 15_000 }
  )
  await expect(page.getByRole("button", { name: /^View / })).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole("list", { name: "Attached files" }).getByText("plan.md")
  ).toBeVisible()
})

test("Escape and Cancel put the attachments back", async ({ page }) => {
  await withAttachments(page)
  await edit(page, 0)
  await page.getByRole("button", { name: "Remove notes.pdf" }).click()
  await expect(editTiles(page)).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "View small.jpg" })
  ).toBeVisible()
  await expect(
    page.getByRole("list", { name: "Attached files" }).getByText("notes.pdf")
  ).toBeVisible()

  await edit(page, 0)
  await expect(editTiles(page)).toHaveCount(2)
  await page.getByRole("button", { name: "Remove small.jpg" }).click()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(
    page.getByRole("button", { name: "View small.jpg" })
  ).toBeVisible()
  await expect(replies(page)).toHaveCount(1)
})

test("an edit with an image waits while the model can't see it", async ({
  page,
}) => {
  await withAttachments(page)
  await pickModel(page, "Ultra")
  await edit(page, 0)
  await expect(
    page.getByRole("status").filter({ hasText: "Ultra can't see images" })
  ).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()
  await page.getByRole("button", { name: "Remove small.jpg" }).click()
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled()
})
