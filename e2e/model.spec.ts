import type { Page } from "@playwright/test"

import {
  expect,
  expectNoHeldStart,
  pickModel,
  recordStartTimes,
  send,
  signInAsDev,
  test,
} from "./session"

// The model picker in the composer (src/components/chat/model-picker.tsx)
// on the mock model, whose reply opens with the model id it was asked for
// and whether the request turned thinking on (src/lib/ai/mock.ts).

const SUPER = "nvidia/nemotron-3.5-super-vl-120b-a12b"
const ULTRA = "nvidia/nemotron-3-ultra-550b-a55b"
const LIGHTNING = "nvidia/nemotron-3.5-lightning-30b-a3b"
const NANO_OMNI = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"

const picker = (page: Page) => page.getByRole("combobox", { name: "Model" })
const lastReply = (page: Page) =>
  page.getByRole("article", { name: "Reply" }).last()

test("a new chat starts on Super, with thinking off", async ({ page }) => {
  await signInAsDev(page)
  await expect(picker(page)).toContainText("Super")
  await send(page, "Hello")
  await expect(lastReply(page)).toContainText(`as ${SUPER} with thinking off.`)
})

test("the chosen model answers, and the chat remembers it", async ({
  page,
}) => {
  await signInAsDev(page)
  await pickModel(page, "Ultra")
  await send(page, "Think about this")
  await expect(lastReply(page)).toContainText(`as ${ULTRA} with thinking on.`)
  await expect(lastReply(page)).toContainText("Done.")

  await page.reload()
  await expect(picker(page)).toContainText("Ultra")

  await pickModel(page, "Lightning")
  await send(page, "Quickly now")
  await expect(lastReply(page)).toContainText(
    `as ${LIGHTNING} with thinking off.`
  )
  await expect(lastReply(page)).toContainText("Done.")
  await page.reload()
  await expect(picker(page)).toContainText("Lightning")

  // A new chat starts on Super again.
  await page.goto("/")
  await expect(picker(page)).toContainText("Super")
})

test("an agent can choose the model", async ({ page }) => {
  await signInAsDev(page)
  const result = await page.evaluate(async () => {
    const { agent } = window
    const entries = agent.snapshot().filter((entry) => entry.offPage !== true)
    const labels = entries.map((entry) => entry.label)
    // By its ref: a label matches by its words, so "Model" would also find
    // a chat in the sidebar named "Talking to the mock model".
    const ref = entries.find((entry) => entry.label === "Model")?.ref ?? ""
    const found = await agent.query({ within: ref, text: "Ultra" })
    const ultra = "error" in found ? undefined : found[0]?.items[0]?.value
    const chosen = await agent.act({
      steps: [{ ref, action: "setValue", args: [ultra] }],
    })
    return { labels, chosen: chosen.ok, error: chosen.error?.message }
  })
  expect(result.labels.every(Boolean)).toBe(true)
  expect(result.labels).toContain("Model")
  expect(result.chosen, result.error).toBe(true)
  await expect(picker(page)).toContainText("Ultra")
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  // ui-sdk held an open's start time a second ahead and set the real one a
  // frame later; WebKit draws from the first, so on an iPhone the sheet
  // showed nothing for a second, then jumped open (ui-sdk #1085, patched
  // in patches/@ui-sdk__core.patch). No start time is set ahead of now.
  test("the sheet's slide starts at once, with no held start time", async ({
    page,
  }) => {
    await recordStartTimes(page)
    await signInAsDev(page)
    await picker(page).tap()
    const sheet = page.locator('[data-slot="select-content"]')
    await expect
      .poll(() =>
        sheet.evaluate((el) => el.style.getPropertyValue("--drawer-progress"))
      )
      .toBe("1")
    await expectNoHeldStart(page)
  })

  test("the models open in a sheet, and the chosen one answers", async ({
    page,
  }) => {
    await signInAsDev(page)
    await picker(page).tap()
    const sheet = page.locator('[data-slot="select-content"]')
    await expect(sheet).toHaveAttribute("data-presentation", "sheet")
    // Tap where the row is, as a finger would, once the sheet has finished
    // sliding up: Playwright's own tap scrolls the row into view first,
    // and the sheet's scroller reads that as a swipe.
    const option = page.getByRole("option", { name: "Nano Omni" })
    await expect
      .poll(() =>
        sheet.evaluate((el) => el.style.getPropertyValue("--drawer-progress"))
      )
      .toBe("1")
    const box = await option.boundingBox()
    if (box === null) throw new Error("The option has no box")
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(picker(page)).toContainText("Nano Omni")
    await send(page, "Hello")
    await expect(lastReply(page)).toContainText(
      `as ${NANO_OMNI} with thinking off.`
    )
  })
})
