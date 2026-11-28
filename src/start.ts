// Start's global setup: every response the server makes (pages, server
// functions and /api) gets the security headers below. Static files come
// from Workers' assets and don't pass through here.
//
// The Content Security Policy is a strict one (web.dev's "strict CSP"): a
// script runs only if it carries this response's nonce, a fresh random one
// each time, or was loaded by one that did ('strict-dynamic'). The
// middleware hands the nonce to the rest of the request through Start's
// context; the router reads it there (src/router.tsx) and TanStack Router
// stamps it on Start's own scripts, ScriptOnce and a csp-nonce meta that
// the browser's router reads back. Everything else may come only from the
// app itself.
import { createMiddleware, createStart } from "@tanstack/react-start"

/** No sniffing types, no framing (clickjacking), and no referrer sent to
 *  other sites. HSTS isn't needed: browsers force HTTPS on all of .dev. */
const STATIC_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
}

/** The policy for a response whose scripts carry `nonce`.
 *  - Images only from the app itself: a reply's markdown can hold an
 *    image, and a model steered by a search result could point one at
 *    another site with the chat in its address, which the browser would
 *    load unasked. data: and blob: are the composer's previews.
 *  - Styles may be inline: ui-sdk, math and code highlighting set style
 *    attributes, and a style can't run code or, with images and fonts
 *    held to the app, reach another site.
 *  - Fonts may be data: URLs: the build inlines the smallest of them.
 *  - connect-src 'self' covers the chat's WebSocket on the same host. */
export function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}

/** 128 random bits, base64: a new one for every response. */
function newNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const nonce = newNonce()
  const result = await next({ context: { nonce } })
  const headers = result.response.headers
  headers.set("Content-Security-Policy", contentSecurityPolicy(nonce))
  for (const [name, value] of Object.entries(STATIC_HEADERS)) {
    headers.set(name, value)
  }
  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}))
