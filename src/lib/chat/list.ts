// The sidebar's chats, as server functions: the signed-in pages' layout
// (src/routes/_app/route.tsx) loads them on the server on first load and
// asks again on client navigation or when the open chat says the list
// changed. The row and header menus (src/components/chat/chat-actions.tsx)
// rename, pin and delete through them: each checks its input with zod and
// touches only the signed-in user's own chat. A rename or pin then has the
// chat's agent tell its open tabs (on any device) to load the list again;
// a delete drops the row, then has the agent tell its tabs and wipe its
// messages.
import { env } from "cloudflare:workers"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { getAgentByName } from "agents"
import { z } from "zod"

import { getAuth } from "@/lib/auth/server"
import { CHAT_ID } from "@/lib/chat/id"
import {
  deleteChatRow,
  listChats,
  updateChat,
  type ChatOwner,
} from "@/lib/chat/store"

/** The signed-in user's id, or null. */
async function userId(): Promise<string | null> {
  const session = await getAuth().api.getSession({
    headers: getRequest().headers,
  })
  return session?.user.id ?? null
}

export const getChats = createServerFn({ method: "GET" }).handler(async () => {
  const user = await userId()
  return user === null ? [] : listChats(env.DB, user)
})

/** The longest title a rename keeps. */
export const TITLE_MAX = 200

const chatId = z.string().regex(CHAT_ID)
const Rename = z.object({
  id: chatId,
  title: z.string().trim().min(1).max(TITLE_MAX),
})
const Pin = z.object({ id: chatId, pinned: z.boolean() })
const Delete = z.object({ id: chatId })

/** The signed-in user's chat `id`, or a throw for no one signed in. */
async function ownChat(id: string): Promise<ChatOwner> {
  const user = await userId()
  if (user === null) throw new Error("Not signed in")
  return { userId: user, id }
}

/** The chat's agent. Its name holds the user's id, so a user reaches only
 *  their own chats' agents, whatever id they send
 *  (src/lib/chat/route.ts names it the same way). */
const agentOf = ({ userId, id }: ChatOwner) =>
  getAgentByName(env.ChatAgent, `${userId}:${id}`)

/** Changes the signed-in user's chat, then tells its open tabs. Only a
 *  chat the user has wakes its agent. */
async function changeChat(
  id: string,
  fields: Parameters<typeof updateChat>[2]
) {
  const owner = await ownChat(id)
  if (!(await updateChat(env.DB, owner, fields)))
    throw new Error("No such chat")
  // Best effort: the write is saved, so failing to tell the other tabs
  // mustn't report it as failed. They catch up on their next load.
  try {
    await (await agentOf(owner)).chatsChanged()
  } catch (error) {
    console.error("Couldn't tell the chat's tabs the list changed", error)
  }
}

export const renameChat = createServerFn({ method: "POST" })
  .validator(Rename)
  .handler(({ data: { id, title } }) => changeChat(id, { title }))

export const pinChat = createServerFn({ method: "POST" })
  .validator(Pin)
  .handler(({ data: { id, pinned } }) => changeChat(id, { pinned }))

/** Deletes the signed-in user's chat for good: its row, which is also
 *  the check that it's theirs, then its agent's messages. The row goes
 *  first, so the tabs the agent then tells to leave load a list without
 *  it; the agent wipes itself from a durable alarm, so a failed RPC after
 *  that would leave only messages no list can reach. */
export const deleteChat = createServerFn({ method: "POST" })
  .validator(Delete)
  .handler(async ({ data: { id } }) => {
    const owner = await ownChat(id)
    if (!(await deleteChatRow(env.DB, owner))) throw new Error("No such chat")
    await (await agentOf(owner)).deleteChat()
  })
