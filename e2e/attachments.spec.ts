import type { FileChooser, Page } from "@playwright/test"

import {
  expect,
  questions,
  replies,
  sidebar,
  signInAsDev,
  test,
  unique,
} from "./session"

// Attaching images to a question (src/components/chat/attachments.tsx) on
// the mock model, which says how many images reached it: + opens a menu
// whose row opens the picker, paste and a drop anywhere add files too,
// the rules turn some away with a toast, and the question shows its
// images, each opening full size, after a reload too.

const WIDE = "e2e/fixtures/wide.png" // 2400 × 1200
const SMALL = "e2e/fixtures/small.jpg" // 400 × 300

const tiles = (page: Page) =>
  page.getByRole("list", { name: "Attached files" }).locator("img")

/** Picks files with + › Add photos & files. */
async function pick(page: Page, files: Parameters<FileChooser["setFiles"]>[0]) {
  await page.getByRole("button", { name: "Attach" }).click()
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("menuitem", { name: "Add photos & files" }).click()
  await (await chooser).setFiles(files)
}

/** A 200 × 100 PNG made in the page, as a DataTransfer, for paste and
 *  drop. */
const pngTransfer = (page: Page) =>
  page.evaluateHandle(async () => {
    const canvas = document.createElement("canvas")
    canvas.width = 200
    canvas.height = 100
    const blob = await new Promise<Blob | null>((done) =>
      canvas.toBlob(done, "image/png")
    )
    const transfer = new DataTransfer()
    if (blob)
      transfer.items.add(new File([blob], "pasted.png", { type: "image/png" }))
    return transfer
  })

test("picked images reach the model, shrunk, and stay with the question", async ({
  page,
}) => {
  await signInAsDev(page)
  await pick(page, [WIDE, SMALL])
  await expect(tiles(page)).toHaveCount(2)

  const message = page.getByRole("textbox", { name: "Message" })
  await message.fill(unique("What's in these?"))
  await page.keyboard.press("Enter")

  await expect(replies(page)).toHaveText([/Saw 2 images\..*Done\.$/])
  const images = page.getByRole("button", { name: /^View / })
  await expect(images).toHaveCount(2)
  // The wide one went at 1600 on its long side, as JPEG.
  const sent = images.first().locator("img")
  await expect(sent).toHaveAttribute("src", /^data:image\/jpeg;/)
  expect(
    await sent.evaluate((img: HTMLImageElement) => [
      img.naturalWidth,
      img.naturalHeight,
    ])
  ).toEqual([1600, 800])

  await images.first().click()
  const viewer = page.getByRole("dialog", { name: "wide.png" })
  await expect(viewer.getByRole("img", { name: "wide.png" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(viewer).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole("button", { name: /^View / })).toHaveCount(2)
  await expect(sidebar(page)).toBeVisible()
})

test("an image alone sends from a new chat", async ({ page }) => {
  await signInAsDev(page)
  await pick(page, [SMALL])
  await expect(tiles(page)).toHaveCount(1)
  await page.getByRole("button", { name: "Send" }).click()

  await expect(page).toHaveURL(/\/c\//)
  await expect(replies(page)).toHaveText([/Saw 1 image\..*Done\.$/])
  await expect(
    page.getByRole("button", { name: "View small.jpg" })
  ).toBeVisible()
  // No words, so no bubble.
  await expect(questions(page)).toHaveCount(0)
})

test("pasted and dropped images attach, and ✕ takes one out", async ({
  page,
}) => {
  await signInAsDev(page)
  const message = page.getByRole("textbox", { name: "Message" })
  await message.evaluate(
    (field, clipboardData) =>
      field.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData, bubbles: true })
      ),
    await pngTransfer(page)
  )
  await expect(tiles(page)).toHaveCount(1)

  const dropped = await pngTransfer(page)
  await page.dispatchEvent("body", "dragenter", { dataTransfer: dropped })
  await expect(page.getByText("Drop to attach")).toBeVisible()
  await page.dispatchEvent("body", "dragover", { dataTransfer: dropped })
  await page.dispatchEvent("body", "drop", { dataTransfer: dropped })
  await expect(tiles(page)).toHaveCount(2)

  await page.getByRole("button", { name: "Remove pasted.png" }).first().click()
  await expect(tiles(page)).toHaveCount(1)
})

test("files the rules turn away never attach, and a toast says why", async ({
  page,
}) => {
  await signInAsDev(page)
  await pick(page, [SMALL, SMALL, SMALL, SMALL, WIDE])
  await expect(tiles(page)).toHaveCount(4)
  await expect(page.getByText("Up to 4 files a message")).toBeVisible()

  await page.getByRole("button", { name: "Remove small.jpg" }).first().click()
  await expect(tiles(page)).toHaveCount(3)
  // Too big, not an image, and a HEIC Chromium can't decode.
  await pick(page, [
    {
      name: "huge.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(11_000_000),
    },
    {
      name: "notes.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("x"),
    },
    { name: "photo.heic", mimeType: "image/heic", buffer: Buffer.from("x") },
  ])
  await expect(
    page.getByText("huge.png: Files can be up to 10 MB")
  ).toBeVisible()
  await expect(
    page.getByText("notes.zip: Only images can be attached")
  ).toBeVisible()
  await expect(page.getByText("Can't read HEIC in this browser")).toBeVisible()
  await expect(tiles(page)).toHaveCount(3)
})
