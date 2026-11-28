// The sidebar's chats, as server functions: the signed-in pages' layout
// (src/routes/_app/route.tsx) loads them with the account, in one call
// (getApp), on the server on first load and asks again on client navigation
// or when the open chat says the list changed. The row and header menus (src/components/chat/chat-actions.tsx)
// rename, pin and delete through them: each checks its input with zod and
// touches only the signed-in user's own chat. A rename or pin then has the
// chat's agent tell its open tabs (on any device) to load the list again;
// a delete drops the row, then has the agent tell its tabs and wipe its
// messages. Feature tour in the account menu adds the demo chat
// (src/lib/chat/tour.ts) through addTour. Search finds chats by their
// messages' words through findInMessages (src/lib/chat/message-index.ts),
// and as it opens, indexOlderChats has a few chats whose words the index
// doesn't hold yet index themselves. Settings › Usage reads the user's
// all-time tokens per model through getUsage (src/lib/chat/usage.ts).
// The Library lists the user's attachments through getLibrary
// (src/lib/chat/library.ts), and has older chats index themselves the same
// way Search does.
import { env } from "cloudflare:workers"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { getAgentByName } from "agents"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"

import { getAuth } from "@/lib/auth/server"
import { accountOf } from "@/lib/auth/session"
import { agentName, CHAT_ID } from "@/lib/chat/id"
import { listAttachments } from "@/lib/chat/library"
import { LIBRARY_ORDERS, LIBRARY_TABS } from "@/lib/chat/library-items"
import { searchMessages } from "@/lib/chat/message-index"
import {
  deleteChatRow,
  listChats,
  putPinnedChat,
  unindexedChats,
  updateChat,
  type ChatOwner,
} from "@/lib/chat/store"
import { TOUR_ID, TOUR_MESSAGES, TOUR_TITLE } from "@/lib/chat/tour"
import { usageByModel } from "@/lib/chat/usage"
import { splitUsage } from "@/lib/settings/usage-split"

/** The signed-in user's id, or null. */
async function userId(): Promise<string | null> {
  const session = await getAuth().api.getSession({
    headers: getRequest().headers,
  })
  return session?.user.id ?? null
}

/** What the signed-in layout needs, in one call: the account and its chat
 *  list, or null for no one signed in. Each navigation and each list
 *  refresh is this one request, not a session check and then a list. */
export const getApp = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAuth().api.getSession({
    headers: getRequest().headers,
  })
  if (session === null) return null
  return {
    user: accountOf(session.user),
    chats: await listChats(env.DB, session.user.id),
  }
})

export const getUsage = createServerFn({ method: "GET" }).handler(async () => {
  const user = await userId()
  return splitUsage(user === null ? [] : await usageByModel(env.DB, user))
})

/** The longest part of a file name the Library's search sends. */
export const NAME_MAX = 255

const Library = z.object({
  tab: z.enum(LIBRARY_TABS),
  name: z.string().max(NAME_MAX),
  order: z.enum(LIBRARY_ORDERS),
  cursor: z.object({ at: z.number().int(), seq: z.number().int() }).optional(),
})

/** A page of the signed-in user's attachments: a tab's, whose names hold
 *  `name`, in `order`, after `cursor` (src/lib/chat/library.ts). */
export const getLibrary = createServerFn({ method: "GET" })
  .validator(Library)
  .handler(async ({ data }) => {
    const user = await userId()
    return user === null ? [] : listAttachments(drizzle(env.DB), user, data)
  })

/** The longest title a rename keeps. */
export const TITLE_MAX = 200

/** The longest text Search sends. */
export const QUERY_MAX = 200

const chatId = z.string().regex(CHAT_ID)
const Rename = z.object({
  id: chatId,
  title: z.string().trim().min(1).max(TITLE_MAX),
})
const Pin = z.object({ id: chatId, pinned: z.boolean() })
const Delete = z.object({ id: chatId })
const Find = z.object({ query: z.string().max(QUERY_MAX) })

/** The signed-in user's chat `id`, or a throw for no one signed in. */
async function ownChat(id: string): Promise<ChatOwner> {
  const user = await userId()
  if (user === null) throw new Error("Not signed in")
  return { userId: user, id }
}

/** The chat's agent, named with agentName. */
const agentOf = (owner: ChatOwner) =>
  getAgentByName(env.ChatAgent, agentName(owner))

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

/** The signed-in user's chats whose messages hold the words typed, best
 *  first, each with its best line (src/lib/chat/message-index.ts). */
export const findInMessages = createServerFn({ method: "GET" })
  .validator(Find)
  .handler(async ({ data: { query } }) => {
    const user = await userId()
    return user === null ? [] : searchMessages(env.DB, user, query)
  })

/** How many chats one indexOlderChats asks to index: each is a call to
 *  its agent, well inside the free plan's 50 subrequests a request. */
const INDEX_BATCH = 10

/** Has up to INDEX_BATCH of the signed-in user's chats that Search's index
 *  doesn't hold yet index themselves whole, the latest first, so their
 *  words and files become findable: Search and the Library call it each
 *  time they open, and a long history fills in over a few opens. Only the
 *  user's own chats, and only their index rows change, never a chat. A
 *  chat that fails is left for the next call. How many were indexed. */
export const indexOlderChats = createServerFn({ method: "POST" }).handler(
  async () => {
    const user = await userId()
    if (user === null) return 0
    const chats = await unindexedChats(env.DB, user, INDEX_BATCH)
    const results = await Promise.allSettled(
      chats.map(async (owner) => (await agentOf(owner)).indexAll())
    )
    for (const result of results)
      if (result.status === "rejected")
        console.error("Couldn't index an older chat", result.reason)
    return results.filter((result) => result.status === "fulfilled").length
  }
)

/** Puts the feature tour (src/lib/chat/tour.ts) in the signed-in user's
 *  list, pinned and unindexed (Search's next open indexes it), or
 *  refreshes it there: always the same chat, so it never
 *  adds a second and touches no other. The row goes first, so the agent's
 *  CHATS_CHANGED loads a list that has it. The chat's id, to open it. */
export const addTour = createServerFn({ method: "POST" }).handler(async () => {
  const owner = await ownChat(TOUR_ID)
  await putPinnedChat(env.DB, owner, TOUR_TITLE)
  await (await agentOf(owner)).replaceMessages(TOUR_MESSAGES)
  return TOUR_ID
})
