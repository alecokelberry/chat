import type { Page } from "@playwright/test"

import {
  expect,
  hydrated,
  pickModel,
  replies,
  send,
  signInAsDev,
  tapInSheet,
  test,
  unique,
} from "./session"

// Settings (src/components/chat/settings.tsx): the account menu's Settings
// opens it at Account (the row itself has no gear); search
// filters its sections; Account shows who's signed in and signs out;
// Appearance flips the theme and wraps replies' long code lines;
// Customize's response style reaches the model (the mock names it) and is
// saved on the account; Usage counts each reply's tokens toward its
// model, all time. On a phone the sections come first, and a tap slides
// to one, with Back.

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Chats" })
const settings = (page: Page) => page.getByRole("dialog", { name: "Settings" })
const sections = (page: Page) =>
  settings(page).getByRole("tablist", { name: "Settings" })

/** Opens Settings from the account menu, as a person does. */
async function openSettings(page: Page) {
  await sidebar(page).getByRole("button", { name: "Dev", exact: true }).click()
  await page.getByRole("menuitem", { name: "Settings" }).click()
}

test.describe("on a computer", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("the account menu's Settings opens it at Account, with focus in search", async ({
    page,
  }) => {
    await signInAsDev(page)
    await openSettings(page)
    await expect(settings(page)).toBeVisible()
    const search = settings(page).getByRole("searchbox", {
      name: "Search settings",
    })
    await expect(search).toBeFocused()
    await expect(
      sections(page).getByRole("tab", { name: "Account" })
    ).toHaveAttribute("aria-selected", "true")
    const account = settings(page).getByRole("tabpanel", { name: "Account" })
    await expect(account).toContainText("Dev")
    // Each test worker signs in as its own Dev (dev+N@chat.test).
    await expect(account).toContainText(/dev(\+\d+)?@chat\.test/)

    await page.keyboard.press("Escape")
    await expect(settings(page)).toBeHidden()
  })

  test("search keeps the sections that match, and says when none do", async ({
    page,
  }) => {
    await signInAsDev(page)
    await openSettings(page)
    const search = settings(page).getByRole("searchbox", {
      name: "Search settings",
    })
    await search.fill("sign")
    await expect(sections(page).getByRole("tab")).toHaveText(["Account"])
    await search.fill("wrap")
    await expect(sections(page).getByRole("tab")).toHaveText(["Appearance"])

    await search.fill("tokens")
    await expect(sections(page).getByRole("tab")).toHaveText(["Usage"])

    await search.fill("zanzibarite")
    await expect(sections(page).getByRole("tab")).toHaveCount(0)
    await expect(settings(page)).toContainText("No settings found")

    await settings(page).getByRole("button", { name: "Clear search" }).click()
    await expect(search).toHaveValue("")
    await expect(search).toBeFocused()
    await expect(sections(page).getByRole("tab")).toHaveText([
      "Account",
      "Appearance",
      "Customize",
      "Usage",
    ])
  })

  test("Sign Out in Account signs out", async ({ page }) => {
    await signInAsDev(page)
    await openSettings(page)
    await settings(page).getByRole("button", { name: "Sign Out" }).click()
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test("Appearance flips the theme and wraps long code lines", async ({
    page,
  }) => {
    await signInAsDev(page)
    await send(page, "Show me some markdown")
    const code = page.locator('[data-streamdown="code-block-body"] pre').first()
    await expect(code).toHaveCSS("white-space", "pre")

    await openSettings(page)
    await sections(page).getByRole("tab", { name: "Appearance" }).click()
    const html = page.locator("html")
    const scheme = await html.getAttribute("data-color-scheme")
    await settings(page).getByRole("button", { name: "Dark theme" }).click()
    await expect(html).not.toHaveAttribute("data-color-scheme", scheme ?? "")

    const wrap = settings(page).getByRole("switch", {
      name: "Wrap long code blocks",
    })
    await expect(wrap).not.toBeChecked()
    // Its name works it too: the row is a Field.
    await settings(page).getByText("Wrap long code blocks").click()
    await expect(wrap).toBeChecked()
    await expect(html).toHaveAttribute("data-code-wrap", "wrap")
    await expect(code).toHaveCSS("white-space", "pre-wrap")

    await page.reload()
    await expect(html).toHaveAttribute("data-code-wrap", "wrap")
  })

  // ui-sdk's agent test: an agent finds the switch by its name and can
  // turn it on.
  test("an agent can turn on Wrap long code blocks", async ({ page }) => {
    await signInAsDev(page)
    await openSettings(page)
    await sections(page).getByRole("tab", { name: "Appearance" }).click()
    const wrap = settings(page).getByRole("switch", {
      name: "Wrap long code blocks",
    })
    await expect(wrap).not.toBeChecked()
    // The agent learns of the switch a beat after it shows, as its part
    // registers, so wait for it there as an agent would.
    const refOf = () =>
      page.evaluate(
        () =>
          window.agent
            .snapshot()
            .find((part) => part.label === "Wrap long code blocks")?.ref ?? ""
      )
    await expect.poll(refOf).not.toBe("")
    const turned = await page.evaluate(
      async (ref) => {
        const result = await window.agent.act({
          steps: [{ ref, action: "setChecked", args: [true] }],
        })
        return result.ok ? "on" : (result.error?.message ?? "refused")
      },
      await refOf()
    )
    expect(turned).toBe("on")
    await expect(wrap).toBeChecked()
  })

  test("Customize's response style reaches the model and stays saved", async ({
    page,
  }) => {
    await signInAsDev(page)
    const openCustomize = async () => {
      await openSettings(page)
      await sections(page).getByRole("tab", { name: "Customize" }).click()
    }
    await openCustomize()
    const style = settings(page).getByRole("combobox", {
      name: /^Response style/,
    })
    await expect(style).toHaveText("Default")
    await style.click()
    const saved = page.waitForResponse(/update-user/)
    await page.getByRole("option", { name: "Concise" }).click()
    expect((await saved).ok()).toBe(true)
    await page.keyboard.press("Escape")

    await send(page, unique("Say hi (style)"))
    await expect(replies(page).last()).toContainText("Styled as concise.")

    // Custom: its words, saved as typing rests.
    await page.reload()
    await hydrated(page)
    await openCustomize()
    await expect(style).toHaveText("Concise")
    await style.click()
    await page.getByRole("option", { name: "Custom" }).click()
    const instructions = settings(page).getByRole("textbox", {
      name: "Custom instructions",
    })
    const typed = page.waitForResponse(/update-user/)
    await instructions.fill("Answer like a pirate.")
    expect((await typed).ok()).toBe(true)
    await page.keyboard.press("Escape")
    await page.goto("/")
    // Before hydration, Enter is only a new line.
    await hydrated(page)
    await send(page, unique("Say hi (style)"))
    await expect(replies(page).last()).toContainText(
      'Styled as custom, "Answer like a pirate.".'
    )

    // Back to Default, which hides the box.
    await openCustomize()
    await style.click()
    await page.getByRole("option", { name: "Default" }).click()
    await expect(settings(page).getByRole("textbox")).toHaveCount(0)
  })

  // ui-sdk's agent test: an agent finds the response style by its name
  // and can choose one, which saves like a pick does.
  test("an agent can choose a response style", async ({ page }) => {
    await signInAsDev(page)
    await openSettings(page)
    await sections(page).getByRole("tab", { name: "Customize" }).click()
    const style = settings(page).getByRole("combobox", {
      name: /^Response style/,
    })
    await expect(style).toHaveText("Default")
    // As with the switch, the agent sees the select a beat after it shows.
    const refOf = () =>
      page.evaluate(
        () =>
          window.agent
            .snapshot()
            .find((part) => part.label?.startsWith("Response style") === true)
            ?.ref ?? ""
      )
    await expect.poll(refOf).not.toBe("")
    const choose = async (value: string) => {
      const saved = page.waitForResponse(/update-user/)
      const ref = await refOf()
      const chosen = await page.evaluate(
        async ([ref, value]) => {
          const result = await window.agent.act({
            steps: [{ ref, action: "setValue", args: [value] }],
          })
          return result.ok ? value : (result.error?.message ?? "refused")
        },
        [ref, value] as const
      )
      expect(chosen).toBe(value)
      expect((await saved).ok()).toBe(true)
    }
    await choose("formal")
    await expect(style).toHaveText("Formal")
    // Back to Default, which the other tests start from.
    await choose("default")
    await expect(style).toHaveText("Default")
  })

  test("Usage counts a reply's tokens toward its model", async ({ page }) => {
    await signInAsDev(page)
    // Other tests on this worker chat as its Dev too, so this checks the
    // count grows, not what it is.
    const tokensOf = async (name: string) => {
      await openSettings(page)
      await sections(page).getByRole("tab", { name: "Usage" }).click()
      const usage = settings(page).getByRole("tabpanel", { name: "Usage" })
      await expect(usage.locator('[aria-busy="false"]')).toBeVisible()
      const row = usage
        .getByRole("list", { name: "Tokens by model" })
        .getByRole("listitem")
        .filter({ hasText: name })
      const text = (await row.count()) === 0 ? "0" : await row.innerText()
      await page.keyboard.press("Escape")
      await expect(settings(page)).toBeHidden()
      return Number(
        /([\d,]+) tokens?$/.exec(text)?.[1]?.replaceAll(",", "") ?? 0
      )
    }
    const before = await tokensOf("Nano Omni")

    await pickModel(page, "Nano Omni")
    await send(page, unique("Count my tokens"))
    await expect(replies(page).last()).toContainText("Done.")

    await expect(async () => {
      expect(await tokensOf("Nano Omni")).toBeGreaterThan(before)
    }).toPass()
    await openSettings(page)
    await sections(page).getByRole("tab", { name: "Usage" }).click()
    await expect(
      settings(page).getByRole("img", {
        name: /^Tokens by model: .*Nano Omni \d+%/,
      })
    ).toBeVisible()
  })

  /** Opens Settings at Customize and returns its two controls. */
  async function openCustomize(page: Page) {
    await openSettings(page)
    await sections(page).getByRole("tab", { name: "Customize" }).click()
    return {
      style: settings(page).getByRole("combobox", { name: /^Response style/ }),
      words: settings(page).getByRole("textbox", {
        name: "Custom instructions",
      }),
    }
  }

  /** Puts the account back on Default with no words, where tests start. */
  async function resetCustomize(page: Page) {
    const status = await page.evaluate(async () => {
      const response = await fetch("/api/auth/update-user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          responseStyle: "default",
          customInstructions: "",
        }),
      })
      return response.status
    })
    expect(status).toBe(200)
  }

  test("the last words typed save as Settings closes", async ({ page }) => {
    await signInAsDev(page)
    const { style, words } = await openCustomize(page)
    await style.click()
    await page.getByRole("option", { name: "Custom" }).click()
    const saved = page.waitForRequest(
      (request) =>
        request.url().includes("update-user") &&
        request.postData()?.includes("Reply in haiku.") === true
    )
    await words.fill("Reply in haiku.")
    // At once, before typing has rested.
    await page.keyboard.press("Escape")
    await expect(settings(page)).toBeHidden()
    await (await saved).response()

    await page.reload()
    await hydrated(page)
    const reopened = await openCustomize(page)
    await expect(reopened.words).toHaveValue("Reply in haiku.")
    await resetCustomize(page)
  })

  test("another browser's change shows when Settings opens", async ({
    page,
    browser,
  }) => {
    await signInAsDev(page)
    // A second browser, signed in before the change: its session cookie
    // still holds Default.
    const other = await browser.newContext()
    const there = await other.newPage()
    await signInAsDev(there)

    const { style } = await openCustomize(page)
    await style.click()
    const saved = page.waitForResponse(/update-user/)
    await page.getByRole("option", { name: "Formal" }).click()
    expect((await saved).ok()).toBe(true)

    const seen = await openCustomize(there)
    await expect(seen.style).toHaveText("Formal")
    await other.close()
    await resetCustomize(page)
  })

  test.describe(() => {
    // The failed request is logged by the browser.
    test.use({ allowedProblems: [/Failed to load resource/] })

    test("a save that fails says so and shows what's saved", async ({
      page,
    }) => {
      await signInAsDev(page)
      const { style } = await openCustomize(page)
      await expect(style).toHaveText("Default")
      await page.route(/update-user/, (route) => route.abort())
      await style.click()
      await page.getByRole("option", { name: "Concise" }).click()
      await expect(
        page.getByText("Couldn't save your response style")
      ).toBeVisible()
      await expect(style).toHaveText("Default")
    })
  })

  test.describe(() => {
    // The refusal is a 400, which the browser logs.
    test.use({ allowedProblems: [/status of 400/] })

    test("the server refuses a response style it doesn't know", async ({
      page,
    }) => {
      await signInAsDev(page)
      const status = await page.evaluate(async () => {
        const response = await fetch("/api/auth/update-user", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ responseStyle: "pirate" }),
        })
        return response.status
      })
      expect(status).toBe(400)
    })

    test("the server refuses Custom words over 1,500 characters", async ({
      page,
    }) => {
      await signInAsDev(page)
      const status = await page.evaluate(async () => {
        const response = await fetch("/api/auth/update-user", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ customInstructions: "x".repeat(1_501) }),
        })
        return response.status
      })
      expect(status).toBe(400)
    })
  })

  test("the account row has no gear", async ({ page }) => {
    await signInAsDev(page)
    await expect(
      sidebar(page).getByRole("button", { name: "Dev", exact: true })
    ).toBeVisible()
    await expect(
      sidebar(page).getByRole("button", { name: "Settings" })
    ).toHaveCount(0)
  })
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("the sections come first, then a tap slides to one and Back returns", async ({
    page,
  }) => {
    await signInAsDev(page)
    await page.getByRole("button", { name: "Open sidebar" }).tap()
    const drawer = page.getByRole("dialog", { name: "Chats" })
    await drawer.getByRole("button", { name: "Dev", exact: true }).tap()
    const menu = page.getByRole("menu")
    await tapInSheet(menu, menu.getByRole("menuitem", { name: "Settings" }))

    const sheet = settings(page)
    await expect(sheet).toBeVisible()
    const account = sections(page).getByRole("tab", { name: "Account" })
    await expect(account).toBeVisible()
    await expect(sheet.getByRole("button", { name: "Sign Out" })).toBeHidden()

    await tapInSheet(sheet, account)
    await expect(sheet.getByRole("button", { name: "Sign Out" })).toBeVisible()
    await expect(account).toBeHidden()

    await sheet.getByRole("button", { name: "Back to settings" }).tap()
    await expect(account).toBeVisible()
  })
})
