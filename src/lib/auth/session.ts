// Sign-in state for routes: server functions, so pages ask the server
// (cookie and D1) both on first load and on client navigation.
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { devSignInAllowed, getAuth } from "@/lib/auth/server"

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getAuth().api.getSession({
      headers: getRequest().headers,
    })
    return session === null ? null : { name: session.user.name }
  }
)

/** Whether /sign-in offers "Sign in as Dev" here. */
export const getDevSignIn = createServerFn({ method: "GET" }).handler(() =>
  devSignInAllowed(getRequest().url)
)
