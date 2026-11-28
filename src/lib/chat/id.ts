import type { ChatOwner } from "@/lib/chat/store"

// A chat's id (a random UUID the browser makes on the first send, which the
// /c/<id> page and the chat list check with CHAT_ID) and the name of its
// agent, `<user id>:<chat id>`, built and read back here. A private chat
// (src/routes/_app/private.tsx) is never saved, so it has no /c/<id> page
// and no row: its id is a UUID behind "private-", which the
// /api/chats/<id> door takes too (AGENT_CHAT_ID), and which tells its agent
// to keep nothing (isPrivateChat).
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

export const CHAT_ID = new RegExp(`^${UUID}$`)

const PRIVATE = "private-"

/** Any id a chat's agent can have: a saved chat's, or a private one's. */
export const AGENT_CHAT_ID = new RegExp(`^(?:${PRIVATE})?${UUID}$`)

/** A fresh private chat's id. */
export const newPrivateChatId = () => `${PRIVATE}${crypto.randomUUID()}`

/** Whether a chat id is a private chat's. */
export const isPrivateChat = (id: string) => id.startsWith(PRIVATE)

/** The name of a chat's agent: `<user id>:<chat id>`. It holds the user's
 *  id, so a user reaches only their own chats' agents, whatever id they
 *  send. The one place the name is built; ownerOf reads it back. */
export const agentName = ({ userId, id }: ChatOwner) => `${userId}:${id}`

/** The user and the chat an agent's name holds. A chat id never holds a
 *  ":" (AGENT_CHAT_ID), so the last one splits them. */
export function ownerOf(name: string): ChatOwner {
  const at = name.lastIndexOf(":")
  return { userId: name.slice(0, at), id: name.slice(at + 1) }
}
