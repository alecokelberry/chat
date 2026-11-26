import type { Page } from "@playwright/test"

import { expect, test } from "./session"

// Installing to the Home Screen: the manifest gives the app its name, icon
// and colors, and the head points iOS at the same icon and colors. Colors
// are checked against the page's own background, so a token change that
// leaves them behind fails here.

/** The page's background in a color scheme, as rgb(…). */
async function background(page: Page, colorScheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme })
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor)
}

/** #rrggbb as getComputedStyle writes it. */
function rgb(hex: string | null) {
  const [r, g, b] = (hex ?? "").match(/[0-9a-f]{2}/gi) ?? []
  return `rgb(${[r, g, b].map((part) => parseInt(part ?? "", 16)).join(", ")})`
}

test("the manifest makes Chat installable as a standalone app", async ({
  page,
  request,
}) => {
  await page.goto("/sign-in")
  const href = await page.locator('link[rel="manifest"]').getAttribute("href")
  expect(href).not.toBeNull()

  const manifest: {
    icons: { src: string; sizes: string }[]
    theme_color: string
    background_color: string
  } = await (await request.get(href ?? "")).json()
  expect(manifest).toMatchObject({
    name: "Chat",
    short_name: "Chat",
    start_url: "/",
    display: "standalone",
  })
  const light = await background(page, "light")
  expect(rgb(manifest.theme_color)).toBe(light)
  expect(rgb(manifest.background_color)).toBe(light)

  const sizes = manifest.icons.map((icon) => icon.sizes)
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]))
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src)
    expect(response.headers()["content-type"]).toBe("image/png")
  }
})

test("iOS gets the icon, and the status bar follows light and dark", async ({
  page,
  request,
}) => {
  await page.goto("/sign-in")

  const touchIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href")
  const icon = await request.get(touchIcon ?? "")
  expect(icon.headers()["content-type"]).toBe("image/png")

  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2)
  for (const scheme of ["light", "dark"] as const) {
    const themeColor = await page
      .locator(
        `meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`
      )
      .getAttribute("content")
    expect(rgb(themeColor)).toBe(await background(page, scheme))
  }
})
