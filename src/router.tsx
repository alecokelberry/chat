// The app's router, made for each request on the server and once in the
// browser. On the server it takes the response's CSP nonce (src/start.ts)
// from Start's context, so TanStack Router stamps it on every script it
// writes and puts it in a csp-nonce meta; the browser reads that meta back,
// so a script added on a later navigation carries it too.
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { getGlobalStartContext } from "@tanstack/react-start"

import { ErrorPage } from "@/components/error-page"
import { routeTree } from "./routeTree.gen"

/** This response's nonce: Start's context on the server, the page's
 *  csp-nonce meta in the browser. None for the router src/server.ts makes
 *  at startup to load the routes' code, outside any request. */
function cspNonce(): string | undefined {
  if (typeof document === "undefined") {
    try {
      return getGlobalStartContext()?.nonce
    } catch {
      return undefined
    }
  }
  return (
    document
      .querySelector('meta[property="csp-nonce"]')
      ?.getAttribute("content") ?? undefined
  )
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ErrorPage,
    ssr: { nonce: cspNonce() },
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
