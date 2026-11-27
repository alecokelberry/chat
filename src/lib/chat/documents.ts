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
  part.type === "data-document" &&
  typeof part.data === "object" &&
  part.data !== null &&
  "text" in part.data &&
  typeof part.data.text === "string"

/** A document as the text the model reads. */
export function documentPrompt({ name, text, cut }: DocumentData) {
  const note = cut ? " (cut at 100,000 characters)" : ""
  return `Attached file "${name}"${note}:\n\n${text.slice(0, TEXT_LIMIT)}`
}

/** A message's documents, in the order they were attached. */
export const documentsOf = (message: UIMessage): DocumentData[] =>
  message.parts.filter(isDocument).map((part) => part.data)
