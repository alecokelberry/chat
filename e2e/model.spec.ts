import { expect, test, type Page } from "@playwright/test"

import { send, signInAsDev } from "./session"

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

async function pick(page: Page, name: string) {
  await picker(page).click()
  await page.getByRole("option", { name }).click()
  await expect(picker(page)).toContainText(name)
}

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
  await pick(page, "Ultra")
  await send(page, "Think about this")
  await expect(lastReply(page)).toContainText(`as ${ULTRA} with thinking on.`)
  await expect(lastReply(page)).toContainText("Done.")

  await page.reload()
  await expect(picker(page)).toContainText("Ultra")

  await pick(page, "Lightning")
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
    const labels = agent
      .snapshot()
      .filter((entry) => entry.offPage !== true)
      .map((entry) => entry.label)
    const found = await agent.query({ within: "Model", text: "Ultra" })
    const ultra = "error" in found ? undefined : found[0]?.items[0]?.value
    const chosen = await agent.act({
      steps: [{ ref: "Model", action: "setValue", args: [ultra] }],
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

  test("the models open in a popover, not a sheet, and the chosen one answers", async ({
    page,
  }) => {
    await signInAsDev(page)
    await picker(page).tap()
    await expect(page.locator('[data-slot="select-content"]')).toHaveAttribute(
      "data-presentation",
      "popover"
    )
    await page.getByRole("option", { name: "Nano Omni" }).tap()
    await expect(picker(page)).toContainText("Nano Omni")
    await send(page, "Hello")
    await expect(lastReply(page)).toContainText(
      `as ${NANO_OMNI} with thinking off.`
    )
  })
})
