import type { Page } from "@playwright/test"

import {
  expect,
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
// while a reply streams.

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
