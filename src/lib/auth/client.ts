// Sign-in in the browser: Better Auth's client with passkeys, talking to
// /api/auth (src/lib/auth/server.ts), and the call that tells the device to
// drop a passkey the server doesn't know.
import { createAuthClient } from "better-auth/react"
import { passkeyClient } from "@better-auth/passkey/client"

export const authClient = createAuthClient({ plugins: [passkeyClient()] })

/** Tells the device a passkey isn't one this server knows, so its passkey
 *  app deletes it and stops offering it (the WebAuthn Signal API: Safari
 *  26, Chrome 132). Returns whether the browser could. Live's and the
 *  Previews' rpIds each belong to one database (wrangler.jsonc). Locally
 *  it's localhost, which every local app shares, so a passkey picked there
 *  may be another app's: sign in as Dev instead. */
export async function forgetPasskey(
  rpId: string,
  credentialId: string
): Promise<boolean> {
  // Older browsers and Firefox don't have it yet.
  if (!("signalUnknownCredential" in PublicKeyCredential)) return false
  try {
    await PublicKeyCredential.signalUnknownCredential({ rpId, credentialId })
    return true
  } catch {
    return false
  }
}
