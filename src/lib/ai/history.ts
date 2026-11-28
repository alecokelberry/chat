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
import {
  convertToModelMessages,
  pruneMessages,
  type ModelMessage,
  type UIMessage,
} from "ai"

import { isImagePart } from "@/lib/chat/attachments"
import { documentPrompt, isDocument } from "@/lib/chat/documents"

/** The chat as the model gets it, for a model that does or doesn't see
 *  images. */
export async function modelMessages(
  messages: UIMessage[],
  seesImages: boolean
): Promise<ModelMessage[]> {
  return pruneMessages({
    messages: await convertToModelMessages(
      messages.map((message) => imagesFor(message, seesImages)),
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
