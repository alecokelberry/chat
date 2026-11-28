// Sign-in state for routes: server functions, so pages ask the server
// (cookie and D1) both on first load and on client navigation. The user
// comes with their Customize choices (src/lib/ai/style.ts) for Settings.
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { toCustomize } from "@/lib/ai/style"
import { devSignInAllowed, getAuth } from "@/lib/auth/server"

/** The account a page shows: name, email and Customize's choices. */
export function accountOf(user: {
  name: string
  email: string
  responseStyle: string
  customInstructions: string
}) {
  const { name, email, responseStyle, customInstructions } = user
  return {
    name,
    email,
    customize: toCustomize({
      style: responseStyle,
      custom: customInstructions,
    }),
  }
}

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getAuth().api.getSession({
      headers: getRequest().headers,
    })
    return session === null ? null : accountOf(session.user)
  }
)

/** Customize's choices as D1 holds them now, for Settings as it opens:
 *  the session above may come from its 5-minute cookie, which a change
 *  made in another browser doesn't reach. */
export const getCustomizeNow = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getAuth().api.getSession({
      headers: getRequest().headers,
      query: { disableCookieCache: true },
    })
    if (session === null) return null
    const { responseStyle, customInstructions } = session.user
    return toCustomize({ style: responseStyle, custom: customInstructions })
  }
)

/** What /sign-in needs: whether it offers "Sign in as Dev" here. */
export const getSignIn = createServerFn({ method: "GET" }).handler(() => ({
  dev: devSignInAllowed(getRequest().url),
}))
