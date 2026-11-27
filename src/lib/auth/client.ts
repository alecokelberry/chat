// Sign-in in the browser: Better Auth's client with passkeys, talking to
// /api/auth (src/lib/auth/server.ts), and the user's two Customize fields
// (src/lib/ai/style.ts), which updateUser saves.
import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"
import { passkeyClient } from "@better-auth/passkey/client"

export const authClient = createAuthClient({
  plugins: [
    passkeyClient(),
    inferAdditionalFields({
      user: {
        responseStyle: { type: "string" },
        customInstructions: { type: "string" },
      },
    }),
  ],
})
