// Sign-in state for routes: server functions, so pages ask the server
// (cookie and D1) both on first load and on client navigation.
import { env } from "cloudflare:workers"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { devSignInAllowed, getAuth } from "@/lib/auth/server"

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getAuth().api.getSession({
      headers: getRequest().headers,
    })
    return session === null
      ? null
      : { name: session.user.name, email: session.user.email }
  }
)

/** What /sign-in needs: whether it offers "Sign in as Dev" here, and the
 *  site its passkeys belong to (the rpId). */
export const getSignIn = createServerFn({ method: "GET" }).handler(() => ({
  dev: devSignInAllowed(getRequest().url),
  rpId: env.PASSKEY_RP_ID,
}))
