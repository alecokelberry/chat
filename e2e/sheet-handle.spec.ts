import AxeBuilder from "@axe-core/playwright"

import { expect, signInAsDev, test } from "./session"

// The grab bar on phone sheets (`sheet-handle`, src/styles/app.css): a
// ::before on a Menu or Select sheet, so it is in no accessibility tree. A
// computer's popover has none. Swipe-to-close is ui-sdk's own.

const bar = (selector: string) => (page: import("@playwright/test").Page) =>
  page
    .locator(selector)
    .evaluate((el) => getComputedStyle(el, "::before").content)

const modelPicker = (page: import("@playwright/test").Page) =>
  page.getByRole("combobox", { name: "Model" })

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 780 },
    hasTouch: true,
    isMobile: true,
  })

  test("the model sheet shows the bar, and axe stays clean", async ({
    page,
  }) => {
    await signInAsDev(page)
    await modelPicker(page).tap()
    const sheet = page.locator('[data-slot="select-content"]')
    await expect(sheet).toHaveAttribute("data-presentation", "sheet")
    expect(await bar('[data-slot="select-content"]')(page)).toBe('""')
    // Chromium has no -webkit-touch-callout, so only user-select is checked.
    await expect(sheet).toHaveCSS("user-select", "none")
    const { violations } = await new AxeBuilder({ page })
      .include('[data-slot="select-content"]')
      .analyze()
    expect(violations.filter((v) => v.impact === "serious")).toEqual([])
  })
})

test("a computer's popover has no bar", async ({ page }) => {
  await signInAsDev(page)
  await modelPicker(page).click()
  const popover = page.locator('[data-slot="select-content"]')
  await expect(popover).toHaveAttribute("data-presentation", "popover")
  expect(await bar('[data-slot="select-content"]')(page)).toBe("none")
  expect(
    await popover.evaluate((el) => getComputedStyle(el).userSelect)
  ).not.toBe("none")
})
