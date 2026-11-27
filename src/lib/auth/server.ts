// Sign-in on the server: Better Auth on D1 with passkeys only. There are no
// passwords and no open sign-up. A passkey is added in one of two ways:
// signed in already, or on /setup with the SETUP_CODE (a Wrangler secret),
// which adds it to the owner's account (the oldest non-Dev one). Locally,
// with DEV_SIGN_IN set, /api/auth/dev-sign-in signs a browser on this
// machine in as Dev.
// Sessions are a signed httpOnly cookie and a row in `session`.
import { env } from "cloudflare:workers"
import { betterAuth, type BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { passkey } from "@better-auth/passkey"
import { z } from "zod"

/** The live address, and what every Preview's address ends with
 *  (<branch>-chat.alecokelberry.workers.dev). */
const LIVE_HOST = "chat.alecokelberry.workers.dev"
const PREVIEW_SUFFIX = "-chat.alecokelberry.workers.dev"

/** The owner's account when there is none yet: setup makes it with these,
 *  and the owner's real name and email are set on the live row (never
 *  here: the repo is public). */
const OWNER = { email: "owner@chat.test", name: "Alec" }
/** Dev: the local test account, kept apart from the owner's. `.test` can't
 *  reach an inbox. */
const DEV = { email: "dev@chat.test", name: "Dev" }

/** Dev's account, or with `as` one of its numbered twins (dev+3@chat.test,
 *  also named Dev): each e2e worker signs in as its own, so parallel tests
 *  never see each other's chats (e2e/session.ts, e2e/seed.sql). */
const devAccount = (as?: string) =>
  as === undefined ? DEV : { ...DEV, email: `dev+${as}@chat.test` }

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
      {
        method: "POST",
        body: z.object({
          as: z
            .string()
            .regex(/^\d{1,3}$/)
            .optional(),
        }),
      },
      async (ctx) => {
        if (ctx.request === undefined || !devSignInAllowed(ctx.request.url)) {
          throw APIError.fromStatus("NOT_FOUND")
        }
        const account = devAccount(ctx.body.as)
        const adapter = ctx.context.internalAdapter
        const find = async () =>
          (await adapter.findUserByEmail(account.email))?.user ?? null
        // Two first sign-ins at once (parallel tests) both find no Dev, and
        // one create loses on the unique email: it takes the winner's.
        const user =
          (await find()) ??
          (await adapter
            .createUser({ ...account, emailVerified: false }, { method: "dev" })
            .catch(async (error: unknown) => {
              const found = await find()
              if (found === null) throw error
              return found
            }))
        const session = await adapter.createSession(user.id)
        await setSessionCookie(ctx, { session, user })
        return ctx.json({ ok: true })
      }
    ),
  },
} satisfies BetterAuthPlugin

/** Signed out, sign-in asks the device only for passkeys this server knows
 *  (allowCredentials), so a passkey left on the phone from a deleted row
 *  isn't offered next to the real one. Better Auth sends that list only
 *  when signed in; signed out it asks for any passkey for the site. The
 *  list goes to anyone who opens /sign-in, which is fine here: credential
 *  ids aren't secret and there's one account. */
const knownPasskeysOnly = {
  id: "known-passkeys-only",
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === "/passkey/generate-authenticate-options",
        handler: createAuthMiddleware(async (ctx) => {
          // Signed in, Better Auth already sent the account's own passkeys.
          if ((await getSessionFromCtx(ctx)) !== null) return
          const options = ctx.context.returned
          if (typeof options !== "object" || options === null) return
          const passkeys = await ctx.context.adapter.findMany<{
            credentialID: string
            transports?: string | null
          }>({ model: "passkey" })
          // None yet: let the device offer any, as before.
          if (passkeys.length === 0) return
          Object.assign(options, {
            allowCredentials: passkeys.map((passkey) => ({
              id: passkey.credentialID,
              type: "public-key",
              transports: passkey.transports?.split(","),
            })),
          })
        }),
      },
    ],
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
    // Better Auth otherwise reads every table's columns from D1 and compares
    // them with its own on each fresh isolate's first session lookup, cookie
    // or not. `pnpm run deploy` migrates before it deploys, so that only
    // costs CPU (docs/decisions.md, Nov 26).
    advanced: { database: { validateSchema: false } },
    // The session also rides in a second signed cookie for 5 minutes, so a
    // request checks it by its signature instead of reading D1 each time
    // (both the page and its chat list ask). Signing out clears it here;
    // another device's sign-out reaches this one within the 5 minutes.
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    plugins: [
      passkey({
        rpName: "Chat",
        // The site passkeys belong to: one per database, so the phone
        // offers one passkey (wrangler.jsonc).
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
            // The owner: the oldest account that isn't Dev's or one of its
            // numbered twins (all named Dev), whatever its email, so the
            // live row can carry the real one. Live there's no Dev account
            // (DEV_SIGN_IN is never set there).
            const [owner] = await adapter.listUsers(
              1,
              0,
              { field: "createdAt", direction: "asc" },
              [
                { field: "email", operator: "ne", value: DEV.email },
                { field: "name", operator: "ne", value: DEV.name },
              ]
            )
            const user =
              owner ??
              (await adapter.createUser(
                { ...OWNER, emailVerified: false },
                { method: "passkey-setup" }
              ))
            return { id: user.id, name: user.email, displayName: user.name }
          },
        },
      }),
      knownPasskeysOnly,
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
