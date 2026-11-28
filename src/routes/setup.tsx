// Adds the owner's first passkey: open /setup#<SETUP_CODE>, tap, and you're
// signed in. A fragment stays in the browser, but the
// passkey request that follows does carry the code, so treat it as spent
// once used: replace it afterwards (README, "Deploying").
import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { AuthError, AuthPage, PasskeyButton } from "@/components/auth-page"
import { authClient } from "@/lib/auth/client"
import { pageTitle } from "@/lib/utils"

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: pageTitle("Set up") }] }),
  component: Setup,
})

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
