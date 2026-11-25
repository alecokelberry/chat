// Adds the owner's first passkey: open /setup#<SETUP_CODE> (the code stays
// in the fragment, so it never reaches the server's logs), tap, and you're
// signed in. Delete the SETUP_CODE secret afterwards to turn this off.
import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { AuthError, AuthPage, PasskeyButton } from "@/components/auth-page"
import { authClient } from "@/lib/auth/client"

export const Route = createFileRoute("/setup")({ component: Setup })

function Setup() {
  const [error, setError] = useState<string | null>(null)

  async function addPasskey() {
    setError(null)
    const { error } = await authClient.passkey.addPasskey({
      context: window.location.hash.slice(1),
      createSession: true,
    })
    if (error === null) window.location.assign("/")
    else setError(error.message ?? "No passkey was added.")
  }

  return (
    <AuthPage>
      <PasskeyButton label="Add a passkey" onClick={addPasskey} />
      <AuthError message={error} />
    </AuthPage>
  )
}
