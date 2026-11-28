// Signing out of this device, from the account menu or Settings: Better
// Auth ends the session, then the app lands on /sign-in. A failure throws,
// so the Button or MenuItem that started it shows it went wrong.
import { useNavigate } from "@tanstack/react-router"

import { authClient } from "@/lib/auth/client"

/** What an agent is told before it signs the user out. */
export const SIGN_OUT_CONFIRM = "Signs you out on this device"

export function useSignOut() {
  const navigate = useNavigate()
  return async function signOut() {
    const { error } = await authClient.signOut()
    if (error) throw new Error(error.message ?? "Couldn't sign out")
    await navigate({ to: "/sign-in" })
  }
}
