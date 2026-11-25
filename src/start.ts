// Start's global setup: every response the server makes (pages, server
// functions and /api) gets the security headers below. Static files come
// from Workers' assets and don't pass through here.
import { createMiddleware, createStart } from "@tanstack/react-start"

/** No sniffing types, no framing (clickjacking), and no referrer sent to
 *  other sites. HSTS isn't needed: browsers force HTTPS on all of .dev. */
export const SECURITY_HEADERS = {
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
}

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next()
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    result.response.headers.set(name, value)
  }
  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}))
