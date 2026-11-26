// Sign-in: one tap, your passkey (src/lib/auth). A passkey the server
// doesn't know (left from an older database) is deleted from the device, so
// the phone stops offering it. On this machine with DEV_SIGN_IN, a second
// button signs in as Dev. Signed in already, it goes straight on to Chat.
import { useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { AuthError, AuthPage, PasskeyButton } from "@/components/auth-page"
import { Button } from "@/components/ui/button"
import { authClient, forgetPasskey } from "@/lib/auth/client"
import { getSession, getSignIn } from "@/lib/auth/session"

export const Route = createFileRoute("/sign-in")({
  beforeLoad: async () => {
    if ((await getSession()) !== null) throw redirect({ to: "/" })
  },
  loader: () => getSignIn(),
  component: SignIn,
})

function SignIn() {
  const { dev, rpId } = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setError(null)
    const result = await authClient.signIn.passkey({
      returnWebAuthnResponse: true,
    })
    if (result.error === null) {
      window.location.assign("/")
    } else if (
      "webauthn" in result &&
      "code" in result.error &&
      result.error.code === "PASSKEY_NOT_FOUND"
    ) {
      const forgotten = await forgetPasskey(rpId, result.webauthn.response.id)
      setError(
        forgotten
          ? "That passkey was out of date, so it's been removed. Try again."
          : "That passkey is out of date. Delete it, then try again."
      )
    } else {
      setError("No passkey was used.")
    }
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
