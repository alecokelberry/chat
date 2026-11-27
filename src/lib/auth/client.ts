// Sign-in in the browser: Better Auth's client with passkeys, talking to
// /api/auth (src/lib/auth/server.ts).
import { createAuthClient } from "better-auth/react"
import { passkeyClient } from "@better-auth/passkey/client"

export const authClient = createAuthClient({ plugins: [passkeyClient()] })
