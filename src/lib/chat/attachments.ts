// Attachments: the files sent with a question. The composer takes up to
// MAX_FILES (picked with +, pasted or dropped), each under MAX_FILE_BYTES,
// and prepares each in the browser into what the message carries
// (attachmentPart). A PDF or text file becomes its text, a document
// (src/lib/chat/documents.ts): a PDF's through unpdf (UnJS's wrapper of
// Mozilla's PDF.js), loaded only when one is picked and never on the
// server; one with no text (a scan) is refused. An
// image is decoded, scaled to fit IMAGE_EDGE on its long side and
// re-encoded as JPEG, as an AI SDK file part with a data URL: small enough
// to send quickly and keep in the chat. The Agents SDK stores a part's
// bytes apart from its message row and deletes them with the chat, so no
// file store is needed. A HEIC photo works where the browser can decode
// it (Safari); elsewhere it's refused with a reason, as is anything else
// that won't decode. No library: the browser's own scaling is good enough
// for a model, and createImageBitmap turns a photo upright.
import type { FileUIPart, UIMessage } from "ai"

import { TEXT_LIMIT, type DocumentPart } from "@/lib/chat/documents"

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
  "application/pdf",
  ".pdf",
  "text/*",
  ...[
    "md",
    "json",
    "csv",
    "tsv",
    "ts",
    "tsx",
    "js",
    "jsx",
    "mjs",
    "py",
    "rb",
    "go",
    "rs",
    "java",
    "kt",
    "swift",
    "c",
    "h",
    "cpp",
    "cs",
    "php",
    "sh",
    "yaml",
    "yml",
    "toml",
    "ini",
    "sql",
    "html",
    "css",
    "xml",
    "log",
    "txt",
  ].map((extension) => `.${extension}`),
]

/** What a question carries for an attached file. */
export type AttachmentPart = FileUIPart | DocumentPart

/** More pages than a question could carry the text of anyway. */
const MAX_PAGES = 1_000

export const isImageFile = (file: File) =>
  file.type.startsWith("image/") || isHeic(file)
const isPdf = (file: File) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name)

/** A picked file as the part a question sends for it. */
export function attachmentPart(file: File): Promise<AttachmentPart> {
  return isImageFile(file) ? imagePart(file) : documentPart(file)
}

/** A PDF's or text file's text, cut at TEXT_LIMIT. */
async function documentPart(file: File): Promise<DocumentPart> {
  const text = (isPdf(file) ? await pdfText(file) : await file.text()).trim()
  if (text.includes("\u0000"))
    throw new AttachmentError(`${file.name}: Not a text file`)
  if (text === "") throw new NoTextError(`${file.name}: No text found`)
  return {
    type: "data-document",
    data: {
      name: file.name || "file",
      mediaType: isPdf(file) ? "application/pdf" : "text/plain",
      text: text.slice(0, TEXT_LIMIT),
      cut: text.length > TEXT_LIMIT,
    },
  }
}

async function pdfText(file: File): Promise<string> {
  if (import.meta.env.SSR) return ""
  const { extractText, getDocumentProxy } = await import("unpdf")
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    if (pdf.numPages > MAX_PAGES)
      throw new AttachmentError(`${file.name}: Over ${MAX_PAGES} pages`)
    const { text } = await extractText(pdf, { mergePages: true })
    return text
  } catch (error) {
    if (error instanceof AttachmentError) throw error
    throw new AttachmentError(`Can't read ${file.name}`)
  }
}

/** A file that can't be attached, with the reason to show. */
export class AttachmentError extends Error {}

/** A document with no text to read, like a scanned PDF: it stays attached,
 *  its chip says "No text found", and Send waits until it's taken out. */
export class NoTextError extends AttachmentError {}

const isHeic = (file: File) =>
  /^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name)

/** A picked image as the file part a question sends: at most IMAGE_EDGE
 *  on its long side, as JPEG. */
async function imagePart(file: File): Promise<FileUIPart> {
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

/** Whether a part is an image a question carries: inline, as a data
 *  URL. The server passes on only these, so it never fetches a link. */
export const isImagePart = (
  part: UIMessage["parts"][number]
): part is FileUIPart =>
  part.type === "file" && part.url.startsWith("data:image/")

/** A question's parts: its attachments, then its words, if any. */
export const questionParts = (
  text: string,
  attachments: AttachmentPart[]
): UIMessage["parts"] => [
  ...attachments,
  ...(text === "" ? [] : [{ type: "text" as const, text }]),
]

/** A message's images, in the order they were attached. */
export const imagesOf = (message: UIMessage): FileUIPart[] =>
  message.parts.filter(isImagePart)

// A new chat's first question leaves the new-chat page with its
// attachments here, for the chat's page to send
// (src/routes/_app/c.$id.tsx): history state, which carries its words, has
// size limits a few photos can pass.
const handedOff = new Map<string, AttachmentPart[]>()

/** Keeps a new chat's first attachments for its page. */
export const handOffFiles = (chatId: string, files: AttachmentPart[]) =>
  handedOff.set(chatId, files)

/** A new chat's first attachments, once: they leave as they're taken. */
export function takeHandedOffFiles(chatId: string): AttachmentPart[] {
  const files = handedOff.get(chatId) ?? []
  handedOff.delete(chatId)
  return files
}
