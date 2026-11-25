// The door to the chats: /api/chats/<id> (the WebSocket) and its
// sub-paths (like /get-messages) go to that chat's agent, for a signed-in
// browser only. The agent is named after the user and the chat, so one
// account can never reach another's chat, whatever id it asks for.
import { env } from "cloudflare:workers"
import { getAgentByName } from "agents"

import { getAuth } from "@/lib/auth/server"

const CHAT_PATH = /^\/api\/chats\/([0-9a-f-]{36})(?:\/|$)/

/** The chat agent's answer to a request for a chat, or null for any other
 *  request. */
export async function routeChatRequest(
  request: Request
): Promise<Response | null> {
  const url = new URL(request.url)
  const id = CHAT_PATH.exec(url.pathname)?.[1]
  if (id === undefined) return null
  // Another site's page can't open a socket with our cookie.
  const origin = request.headers.get("Origin")
  if (origin !== null && origin !== url.origin) {
    return new Response(null, { status: 403 })
  }
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (session === null) return new Response(null, { status: 401 })
  const agent = await getAgentByName(env.ChatAgent, `${session.user.id}:${id}`)
  return agent.fetch(request)
}
