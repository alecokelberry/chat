// What the model is sent of a chat each turn: the chat's messages as model
// messages, with each image as the chosen model takes it and each document
// as its text, and with old thinking and old tool calls left out
// (pruneMessages, as the AI SDK and Agents SDK docs suggest): only the last
// message keeps its thinking, and only the last two keep their searches and
// pages. An old reply's answer stays; the pages it read to write it (up to
// READ_LIMIT of 8,000 characters each) and its search results don't, so a
// long chat doesn't grow by every page ever read. What the thread shows is
// never touched: this is only the copy that goes to the model. Pure, so
// unit tests check it in Node.
//
// A long chat is fitted to HISTORY_BUDGET (fitHistory), after its images
// are made what the chosen model takes, so it counts what is really sent.
// Its size is counted in characters, about four to a token: each text and
// each document's text by its length, and each image as IMAGE_COST (an
// "[image: name]" for a model that can't see is just its text). Thinking and
// tool calls don't count, since pruneMessages drops every old one. The
// instructions aren't part of the chat, so they always go. The last
// question, with all its files, and anything after it always go whole.
// While the chat is over budget, its oldest turn (a question and its reply,
// with their files) is dropped. A chat within budget goes exactly as it
// is. Counting is a sum of lengths, well inside the free plan's CPU.
import {
  convertToModelMessages,
  pruneMessages,
  type ModelMessage,
  type UIMessage,
} from "ai"

import { isImagePart } from "@/lib/chat/attachments"
import { documentPrompt, isDocument } from "@/lib/chat/documents"

/** The most of a chat, in characters, that goes to the model: about
 *  37,000 tokens, which keeps a reply quick and leaves the model's window
 *  plenty of room, yet holds a whole 100,000-character document and the
 *  talk around it. */
const HISTORY_BUDGET = 150_000

/** What an image counts as: about what a 1600-pixel photo costs a vision
 *  model in tokens, in characters. */
const IMAGE_COST = 8_000

/** The chat as the model gets it, for a model that does or doesn't see
 *  images. */
export async function modelMessages(
  messages: UIMessage[],
  seesImages: boolean
): Promise<ModelMessage[]> {
  return pruneMessages({
    messages: await convertToModelMessages(
      fitHistory(messages.map((message) => imagesFor(message, seesImages))),
      {
        convertDataPart: (part) =>
          isDocument(part)
            ? { type: "text", text: documentPrompt(part.data) }
            : undefined,
      }
    ),
    reasoning: "before-last-message",
    toolCalls: "before-last-2-messages",
  })
}

/** A message's images as the model takes them: inline, for a model
 *  that sees images, or "[image: name]" in each one's place for one that
 *  doesn't, so a chat with images goes on after a switch to Ultra. Only
 *  inline images (data URLs, src/lib/chat/attachments.ts) count: any other
 *  file part, like a link the AI SDK would fetch from the server, is
 *  dropped. */
function imagesFor(message: UIMessage, seesImages: boolean): UIMessage {
  return {
    ...message,
    parts: message.parts.flatMap((part): UIMessage["parts"] => {
      if (part.type !== "file") return [part]
      if (!isImagePart(part)) return []
      if (seesImages) return [part]
      return [{ type: "text", text: `[image: ${part.filename ?? "image"}]` }]
    }),
  }
}

type Part = UIMessage["parts"][number]

/** What a part counts toward the budget. */
function partSize(part: Part): number {
  if (part.type === "text") return part.text.length
  if (isDocument(part)) return documentPrompt(part.data).length
  if (isImagePart(part)) return IMAGE_COST
  return 0
}

const messageSize = (message: UIMessage) =>
  message.parts.reduce((sum, part) => sum + partSize(part), 0)

/** A chat's size, as fitHistory counts it. */
export const historySize = (messages: UIMessage[]) =>
  messages.reduce((sum, message) => sum + messageSize(message), 0)

/** The chat fitted to `budget` characters, as the comment at the top
 *  says. The chat itself is never changed. */
export function fitHistory(
  messages: UIMessage[],
  budget = HISTORY_BUDGET
): UIMessage[] {
  let size = historySize(messages)
  const last = messages.findLastIndex((message) => message.role === "user")
  if (size <= budget || last <= 0) return messages
  // Oldest turns first, keeping the chat starting on a question.
  let start = 0
  for (const [index, message] of messages.entries()) {
    if (index >= last || (size <= budget && message.role === "user")) break
    size -= messageSize(message)
    start = index + 1
  }
  return start === 0 ? messages : messages.slice(start)
}
