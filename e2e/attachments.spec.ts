import type { Page } from "@playwright/test"

import {
  expect,
  pick,
  pickModel,
  questions,
  replies,
  send,
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

  const other = await page.context().newPage()
  await other.goto(page.url())
  await expect(other.getByRole("button", { name: /^View / })).toHaveCount(2)
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
  // The list is one Tab stop, and Delete takes out the focused file.
  await page.getByRole("list", { name: "Attached files" }).focus()
  await page.keyboard.press("Delete")
  await expect(tiles(page)).toHaveCount(0)
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

test("a model that can't see images holds Send, and one tap switches", async ({
  page,
}) => {
  await signInAsDev(page)
  await pickModel(page, "Ultra")
  await pick(page, [SMALL])
  await expect(tiles(page)).toHaveCount(1)
  const send = page.getByRole("button", { name: "Send" })
  await expect(
    page.getByRole("status").filter({ hasText: "Ultra can't see images" })
  ).toHaveCount(1)
  await expect(send).toBeDisabled()

  // Taking the image out also lets it send, on the model chosen.
  await pickModel(page, "Lightning")
  await expect(
    page.getByRole("status").filter({ hasText: "Lightning can't see images" })
  ).toHaveCount(1)
  await expect(send).toBeDisabled()
  await page.getByRole("button", { name: "Remove small.jpg" }).click()
  await page.getByRole("textbox", { name: "Message" }).fill("Just words")
  await expect(send).toBeEnabled()
  await expect(page.getByRole("combobox", { name: "Model" })).toContainText(
    "Lightning"
  )

  // An agent finds Switch to Super by name, and the image goes to Super.
  await pickModel(page, "Ultra")
  await pick(page, [SMALL])
  await expect(
    page.getByRole("status").filter({ hasText: "Ultra can't see images" })
  ).toHaveCount(1)
  const switched = await page.evaluate(async () => {
    const { agent } = window
    const found = await agent.query({ text: "Switch to Super" })
    const ref =
      "error" in found
        ? ""
        : (found.find((entry) => entry.label === "Switch to Super")?.ref ?? "")
    const done = await agent.act({
      steps: [{ ref, action: "press", args: [] }],
    })
    return done.ok
  })
  expect(switched).toBe(true)
  await expect(page.getByRole("combobox", { name: "Model" })).toContainText(
    "Super"
  )
  await expect(page.getByText("can't see images")).toHaveCount(0)
  await expect(send).toBeEnabled()
  await send.click()
  await expect(replies(page)).toHaveText([/Saw 1 image\..*Done\.$/], {
    timeout: 15_000,
  })
})

test("a chat with images goes on with Ultra, told what each image was", async ({
  page,
}) => {
  await signInAsDev(page)
  await pick(page, [WIDE, SMALL])
  await expect(tiles(page)).toHaveCount(2)
  await page.getByRole("textbox", { name: "Message" }).fill(unique("Look"))
  await page.keyboard.press("Enter")
  await expect(replies(page)).toHaveText([/Saw 2 images\..*Done\.$/])
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible()

  await pickModel(page, "Ultra")
  await send(page, unique("And now?"))
  await expect(replies(page).nth(1)).toHaveText(/Told of 2 images\..*Done\.$/, {
    timeout: 15_000,
  })
  await expect(replies(page).nth(1)).not.toContainText("Saw")
})

// ui-sdk's agent bridge (window.agent, test builds): an agent finds
// Attach by name and opens its menu, takes a file out through the file
// input, and opens an image.
test("an agent can open the menu, take a file out and view an image", async ({
  page,
}) => {
  await signInAsDev(page)
  // By query, not the snapshot, which lists only the first 100
  // components (e2e/search.spec.ts).
  const press = (label: string) =>
    page.evaluate(async (wanted) => {
      const { agent } = window
      const found = await agent.query({ text: wanted })
      const ref =
        "error" in found
          ? ""
          : (found.find((entry) => entry.label === wanted)?.ref ?? "")
      const done = await agent.act({
        steps: [{ ref, action: "press", args: [] }],
      })
      return done.ok
    }, label)

  expect(await press("Attach")).toBe(true)
  await expect(
    page.getByRole("menuitem", { name: "Add photos & files" })
  ).toBeVisible()
  await page.keyboard.press("Escape")

  await pick(page, [SMALL, WIDE])
  await expect(tiles(page)).toHaveCount(2)
  // The file input offers removeFile, naming a file by its item.
  const removed = await page.evaluate(async () => {
    const { agent } = window
    // A query lists only the items its text matches.
    const found = await agent.query({ text: "wide.png" })
    const input =
      "error" in found
        ? undefined
        : found.find((entry) => entry.label === "Attachments")
    // An item carries its file's name as its label, which the type leaves out.
    const item = input?.items.find(
      (entry) => "label" in entry && entry.label === "wide.png"
    )
    const done = await agent.act({
      steps: [
        { ref: input?.ref ?? "", action: "removeFile", args: [item?.value] },
      ],
    })
    return done.ok
  })
  expect(removed).toBe(true)
  await expect(tiles(page)).toHaveCount(1)
  await page.getByRole("button", { name: "Send" }).click()
  await expect(replies(page)).toHaveText([/Saw 1 image\..*Done\.$/])

  expect(await press("View small.jpg")).toBe(true)
  await expect(page.getByRole("dialog", { name: "small.jpg" })).toBeVisible()
})
