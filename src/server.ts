// The Worker's entry: chat requests go to their agent (src/lib/chat), and
// everything else to TanStack Start, with the app's code loaded up front.
// Start imports the router, Better Auth and each route's component lazily,
// so a fresh isolate's first request paid for loading them out of its 10 ms
// of CPU. Here they load at startup, which has its own 1 s. The agent's
// Durable Object class is exported here so Workers can find it
// (wrangler.jsonc).
import handler from "@tanstack/react-start/server-entry"

import { getAuth } from "./lib/auth/server"
import { routeChatRequest } from "./lib/chat/route"
import { getRouter } from "./router"

export { ChatAgent } from "./lib/chat/agent"

const router = getRouter()
// Every route's split-off code, which Start would load on first render.
// (The async wrapper is there because loadRouteChunk may return undefined.)
await Promise.all(
  Object.values(router.routesById).map(async (route) => {
    await router.loadRouteChunk(route)
  })
)
// Better Auth's instance, which its first use would make.
getAuth()

export default {
  async fetch(request) {
    return (await routeChatRequest(request)) ?? handler.fetch(request)
  },
} satisfies ExportedHandler<Env>
