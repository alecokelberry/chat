// Sign-in state for routes: server functions, so pages ask the server
// (cookie and D1) both on first load and on client navigation. The user
// comes with their Customize choices (src/lib/ai/style.ts) for Settings.
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { devSignInAllowed, getAuth } from "@/lib/auth/server"

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getAuth().api.getSession({
      headers: getRequest().headers,
    })
    if (session === null) return null
    const { name, email, responseStyle, customInstructions } = session.user
    return {
      name,
      email,
      customize: { style: responseStyle, custom: customInstructions },
    }
  }
)

/** What /sign-in needs: whether it offers "Sign in as Dev" here. */
export const getSignIn = createServerFn({ method: "GET" }).handler(() => ({
  dev: devSignInAllowed(getRequest().url),
}))
