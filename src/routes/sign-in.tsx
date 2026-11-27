// Sign-in: one tap, your passkey (src/lib/auth). The device is asked only
// for passkeys the server knows, so one left from an older database isn't
// offered. On this machine with DEV_SIGN_IN, a second
// button signs in as Dev. Signed in already, it goes straight on to Chat.
import { useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { AuthError, AuthPage, PasskeyButton } from "@/components/auth-page"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"
import { getSession, getSignIn } from "@/lib/auth/session"

export const Route = createFileRoute("/sign-in")({
  beforeLoad: async () => {
    if ((await getSession()) !== null) throw redirect({ to: "/" })
  },
  loader: () => getSignIn(),
  head: () => ({ meta: [{ title: "Sign in – Chat" }] }),
  component: SignIn,
})

function SignIn() {
  const { dev } = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setError(null)
    const { error } = await authClient.signIn.passkey()
    if (error === null) window.location.assign("/")
    else setError("No passkey was used.")
  }

  async function signInAsDev() {
    const { error } = await authClient.$fetch("/dev-sign-in", {
      method: "POST",
      body: {},
    })
    if (error === null) window.location.assign("/")
    else setError("Dev sign-in isn't on here.")
  }

  return (
    <AuthPage>
      <PasskeyButton label="Sign in with passkey" onClick={signIn} />
      {dev && <Button onClick={signInAsDev}>Sign in as Dev</Button>}
      <AuthError message={error} />
    </AuthPage>
  )
}
