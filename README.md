# Chat

My own AI chat on free NVIDIA models, running on Cloudflare's free plan. A personal project: see `AGENTS.md` for how it's built and `docs/plan.md` for where it's going.

## Running it locally

Make a `.dev.vars` with three lines, then `pnpm wrangler d1 migrations apply chat --local` and `pnpm dev`:

```
BETTER_AUTH_SECRET=<any 32+ characters>
SETUP_CODE=<anything; /setup#<it> adds a passkey>
DEV_SIGN_IN=1
```

`DEV_SIGN_IN=1` shows "Sign in as Dev" on `/sign-in`, on localhost only.
