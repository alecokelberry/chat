// The door to the chats: /api/chats/<id> (the WebSocket) and its
// sub-paths (like /get-messages) go to that chat's agent, for a signed-in
// browser only. The agent is named after the user and the chat, so one
// account can never reach another's chat, whatever id it asks for.
import { env } from "cloudflare:workers"
import { getAgentByName } from "agents"

import { getAuth } from "@/lib/auth/server"
import { CHAT_ID } from "@/lib/chat/id"

const CHAT_PATH = /^\/api\/chats\/([^/]+)(?:\/|$)/

/** The chat agent's answer to a request for a chat, or null for any other
 *  request. */
export async function routeChatRequest(
  request: Request
): Promise<Response | null> {
  const url = new URL(request.url)
  const id = CHAT_PATH.exec(url.pathname)?.[1]
  if (id === undefined) return null
  if (!CHAT_ID.test(id)) return new Response(null, { status: 404 })
  // Another site's page can't open a socket with our cookie. Browsers
  // always send Origin on a WebSocket; a request without one isn't a page.
  const origin = request.headers.get("Origin")
  if (origin !== null && origin !== url.origin) {
    return new Response(null, { status: 403 })
  }
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (session === null) return new Response(null, { status: 401 })
  const agent = await getAgentByName(env.ChatAgent, `${session.user.id}:${id}`)
  return agent.fetch(request)
}
