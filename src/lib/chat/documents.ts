// A document: a PDF or text file sent with a question, as its text. The
// browser reads the text (src/lib/chat/attachments.ts), and the question
// carries it as a `data-document` part, so any model can answer about it,
// whether or not it sees images, and the thread can show the file's name.
// The model gets each one as a text part (documentPrompt), cut at
// TEXT_LIMIT characters with a note saying so. Shared by the browser and
// the server, so it imports nothing.
import type { UIMessage } from "ai"

/** The most of a document's text a question carries. */
export const TEXT_LIMIT = 100_000

export type DocumentData = {
  name: string
  mediaType: string
  text: string
  /** The text was longer than TEXT_LIMIT and was cut there. */
  cut: boolean
}

export type DocumentPart = { type: "data-document"; data: DocumentData }

export const isDocument = (
  part: UIMessage["parts"][number]
): part is DocumentPart =>
  part.type === "data-document" && isDocumentData(part.data)

/** Whether a part's data has a document's shape: a part comes from the
 *  browser, and a missing name would break its chip and its prompt. By
 *  hand, since zod would add 20 KB to the page. */
const isDocumentData = (data: unknown): data is DocumentData =>
  typeof data === "object" &&
  data !== null &&
  "name" in data &&
  typeof data.name === "string" &&
  "mediaType" in data &&
  typeof data.mediaType === "string" &&
  "text" in data &&
  typeof data.text === "string" &&
  "cut" in data &&
  typeof data.cut === "boolean"

/** A document as the text the model reads. */
export function documentPrompt({ name, text, cut }: DocumentData) {
  const note = cut
    ? ` (cut at ${TEXT_LIMIT.toLocaleString("en-US")} characters)`
    : ""
  return `Attached file "${name}"${note}:\n\n${text.slice(0, TEXT_LIMIT)}`
}

/** A message's documents, in the order they were attached. */
export const documentsOf = (message: UIMessage): DocumentData[] =>
  message.parts.filter(isDocument).map((part) => part.data)
