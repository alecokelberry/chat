import type { ChatOwner } from "@/lib/chat/store"

// A chat's id (a random UUID the browser makes on the first send, which the
// /c/<id> page and the /api/chats/<id> door check with CHAT_ID) and the name
// of its agent, `<user id>:<chat id>`, built and read back here.
export const CHAT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The name of a chat's agent: `<user id>:<chat id>`. It holds the user's
 *  id, so a user reaches only their own chats' agents, whatever id they
 *  send. The one place the name is built; ownerOf reads it back. */
export const agentName = ({ userId, id }: ChatOwner) => `${userId}:${id}`

/** The user and the chat an agent's name holds. A chat id never holds a
 *  ":" (CHAT_ID), so the last one splits them. */
export function ownerOf(name: string): ChatOwner {
  const at = name.lastIndexOf(":")
  return { userId: name.slice(0, at), id: name.slice(at + 1) }
}
