// Sign-in on the server: Better Auth on D1 with passkeys only. There are no
// passwords and no open sign-up. A passkey is added in one of two ways:
// signed in already, or on /setup with the SETUP_CODE (a Wrangler secret),
// which adds it to the owner's account. Locally, with DEV_SIGN_IN
// set, /api/auth/dev-sign-in signs a browser on this machine in as Dev.
// Sessions are a signed httpOnly cookie and a row in `session`.
import { env } from "cloudflare:workers"
import { betterAuth, type BetterAuthPlugin } from "better-auth"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { passkey } from "@better-auth/passkey"

/** The live address, and what every Preview's address ends with
 *  (<branch>-chat.alecokelberry.workers.dev). */
const LIVE_HOST = "chat.alecokelberry.workers.dev"
const PREVIEW_SUFFIX = "-chat.alecokelberry.workers.dev"

/** Whose account a passkey added with the setup code joins. */
const OWNER = { email: "owner@chat.test", name: "Alec" }
/** Dev: the local test account, kept apart from the owner's. `.test` can't
 *  reach an inbox. */
const DEV = { email: "dev@chat.test", name: "Dev" }

/** Whether Dev can sign in from this address: only with DEV_SIGN_IN set
 *  (.dev.vars and e2e, never live) and only on localhost. */
export function devSignInAllowed(url: string): boolean {
  return env.DEV_SIGN_IN === "1" && new URL(url).hostname === "localhost"
}

/** Whether the setup code is right, comparing SHA-256 digests so the time
 *  taken says nothing about the code. */
async function sameCode(a: string, b: string): Promise<boolean> {
  const digest = async (text: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    ).toString()
  const [x, y] = await Promise.all([digest(a), digest(b)])
  return x === y
}

/** Signs a browser on this machine in as Dev. Only registered when
 *  DEV_SIGN_IN is "1", and answers only where devSignInAllowed. */
const devSignIn = {
  id: "dev-sign-in",
  endpoints: {
    devSignIn: createAuthEndpoint(
      "/dev-sign-in",
      { method: "POST" },
      async (ctx) => {
        if (ctx.request === undefined || !devSignInAllowed(ctx.request.url)) {
          throw APIError.fromStatus("NOT_FOUND")
        }
        const adapter = ctx.context.internalAdapter
        const user =
          (await adapter.findUserByEmail(DEV.email))?.user ??
          (await adapter.createUser(
            { ...DEV, emailVerified: false },
            { method: "dev" }
          ))
        const session = await adapter.createSession(user.id)
        await setSessionCookie(ctx, { session, user })
        return ctx.json({ ok: true })
      }
    ),
  },
} satisfies BetterAuthPlugin

function createAuth() {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    // The address comes from the request, so live, Previews and local all
    // work. A Preview's own origin is trusted only on its own host, so a
    // passkey signed on one Preview can't be replayed on another or live.
    baseURL: { allowedHosts: [LIVE_HOST, `*${PREVIEW_SUFFIX}`, "localhost:*"] },
    trustedOrigins: (request) => {
      const url = request === undefined ? undefined : new URL(request.url)
      return url?.hostname.endsWith(PREVIEW_SUFFIX) === true ? [url.origin] : []
    },
    telemetry: { enabled: false },
    plugins: [
      passkey({
        rpName: "Chat",
        // alecokelberry.workers.dev live and in Previews (workers.dev is the
        // public suffix, so one account's subdomains can share it), so one
        // passkey works on both; localhost locally.
        rpID: env.PASSKEY_RP_ID,
        registration: {
          // Signed in, a passkey joins your own account. Signed out, only
          // with the setup code, and then it joins the owner's.
          requireSession: false,
          resolveUser: async ({ ctx, context }) => {
            // Without the code /setup does nothing; live, it is turned off by
            // replacing it with a random one nobody knows (README.md).
            // (Typed as a string, but unset is undefined at runtime.)
            const code: unknown = env.SETUP_CODE
            if (
              typeof code !== "string" ||
              code === "" ||
              typeof context !== "string" ||
              !(await sameCode(context, code))
            ) {
              throw APIError.fromStatus("UNAUTHORIZED", {
                message: "That setup code isn't right.",
              })
            }
            const adapter = ctx.context.internalAdapter
            const user =
              (await adapter.findUserByEmail(OWNER.email))?.user ??
              (await adapter.createUser(
                { ...OWNER, emailVerified: false },
                { method: "passkey-setup" }
              ))
            return { id: user.id, name: user.email, displayName: user.name }
          },
        },
      }),
      ...(env.DEV_SIGN_IN === "1" ? [devSignIn] : []),
      // Last, so it sees every cookie the others set.
      tanstackStartCookies(),
    ],
  })
}

let auth: ReturnType<typeof createAuth> | undefined

/** The one Better Auth instance, made once per isolate. */
export function getAuth() {
  auth ??= createAuth()
  return auth
}
