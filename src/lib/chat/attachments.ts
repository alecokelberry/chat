// Attachments: the files sent with a question. The composer takes up to
// MAX_FILES (picked with +, pasted or dropped), each under MAX_FILE_BYTES,
// and prepares each in the browser into what the message carries. An
// image is decoded, scaled to fit IMAGE_EDGE on its long side and
// re-encoded as JPEG, as an AI SDK file part with a data URL: small enough
// to send quickly and keep in the chat. The Agents SDK stores a part's
// bytes apart from its message row and deletes them with the chat, so no
// file store is needed. A HEIC photo works where the browser can decode
// it (Safari); elsewhere it's refused with a reason, as is anything else
// that won't decode. No library: the browser's own scaling is good enough
// for a model, and createImageBitmap turns a photo upright.
import type { FileUIPart, UIMessage } from "ai"

export const MAX_FILES = 4
export const MAX_FILE_BYTES = 10_000_000
const IMAGE_EDGE = 1600

/** What the picker offers and paste and drop take. */
export const ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  ".heic",
  ".heif",
]

/** A file that can't be attached, with the reason to show. */
export class AttachmentError extends Error {}

const isHeic = (file: File) =>
  /^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name)

/** A picked image as the file part a question sends: at most IMAGE_EDGE
 *  on its long side, as JPEG. */
export async function imagePart(file: File): Promise<FileUIPart> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new AttachmentError(
      isHeic(file)
        ? "Can't read HEIC in this browser"
        : `Can't read ${file.name || "this image"}`
    )
  })
  const scale = Math.min(1, IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  // A transparent PNG goes on white, not JPEG's black.
  if (context) {
    context.fillStyle = "#fff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  }
  bitmap.close()
  return {
    type: "file",
    mediaType: "image/jpeg",
    filename: file.name || "image.jpg",
    url: canvas.toDataURL("image/jpeg", 0.85),
  }
}

/** A message's images, in the order they were attached. */
export const imagesOf = (message: UIMessage): FileUIPart[] =>
  message.parts.filter(
    (part): part is FileUIPart =>
      part.type === "file" && part.mediaType.startsWith("image/")
  )

// A new chat's first question leaves the new-chat page with its images
// here, for the chat's page to send (src/routes/_app/c.$id.tsx): history
// state, which carries its words, has size limits a few photos can pass.
const handedOff = new Map<string, FileUIPart[]>()

/** Keeps a new chat's first images for its page. */
export const handOffFiles = (chatId: string, files: FileUIPart[]) =>
  handedOff.set(chatId, files)

/** A new chat's first images, once: they leave as they're taken. */
export function takeHandedOffFiles(chatId: string): FileUIPart[] {
  const files = handedOff.get(chatId) ?? []
  handedOff.delete(chatId)
  return files
}
