// The Worker's entry: chat requests go to their agent (src/lib/chat), a
// missing file gets a bare 404, and everything else goes to TanStack Start,
// with the app's code loaded and warmed up front.
// On the free plan a request gets 10 ms of CPU, and with little traffic
// nearly every request is the first one its isolate serves. Work that
// happens once per isolate (loading Start's lazy route chunks and Better
// Auth, building the class-name merger's tables) is done here at startup,
// which has its own 1 s. The agent's Durable Object class is exported here
// so Workers can find it (wrangler.jsonc).
import handler from "@tanstack/react-start/server-entry"

import { getAuth } from "./lib/auth/server"
import { routeChatRequest } from "./lib/chat/route"
import { cn } from "./lib/utils"
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
// cn compiles its Tailwind tables on its first call, which every page's
// render makes.
cn("p-1", "p-2")

/** A path that names a file: Workers serves the files that exist before the
 *  Worker runs, so one that reaches here doesn't (an old build's
 *  /assets/<hash>.js, a browser's /favicon.ico). It gets a 404 without the
 *  app rendering one. No route may end in a dot and letters: a route like
 *  /sitemap.xml would need an exception here. */
const FILE_PATH = /\.[a-z0-9]+$/i

export default {
  async fetch(request) {
    if (FILE_PATH.test(new URL(request.url).pathname)) {
      return new Response(null, { status: 404 })
    }
    return (await routeChatRequest(request)) ?? handler.fetch(request)
  },
} satisfies ExportedHandler<Env>
