# Chat

My own AI chat on free NVIDIA models, running on Cloudflare's free plan. A personal project: see `AGENTS.md` for how it's built and the open issues for where it's going.

## Running it locally

Make a `.dev.vars` with four lines, then `pnpm wrangler d1 migrations apply chat --local` and `pnpm dev`:

```
BETTER_AUTH_SECRET=<any 32+ characters>
SETUP_CODE=<anything; /setup#<it> adds a passkey>
DEV_SIGN_IN=1
PASSKEY_RP_ID=localhost
```

`DEV_SIGN_IN=1` shows "Sign in as Dev" on `/sign-in`, on localhost only.

## Deploying

Every push to `main` deploys through Cloudflare Workers Builds, which runs `pnpm run deploy`: it builds, applies new migrations to the live database and deploys to chat.alecokelberry.workers.dev. Run it by hand only if Workers Builds is down.

Every push to another branch builds a Preview with `pnpm run deploy:preview`, and Workers Builds comments its address on the PR: `<branch>-chat.alecokelberry.workers.dev`. Previews share the `chat-preview` database, which gets the branch's migrations, and their own secrets, never the live ones. Your passkey belongs to `alecokelberry.workers.dev`, so it signs in on both, once you've added it on each (the setup code below, with `pnpm wrangler preview base-config secret put SETUP_CODE` and a Preview's address for a Preview).

To add a passkey while signed out (a new device), this sets a fresh setup code and opens `/setup` with it, without showing the code:

```bash
code=$(openssl rand -hex 24); printf %s "$code" | pnpm wrangler secret put SETUP_CODE && open "https://chat.alecokelberry.workers.dev/setup#$code"
```

Afterwards, turn `/setup` off again by replacing the code with one nobody knows. Don't delete it: Wrangler won't deploy without it.

```bash
openssl rand -hex 24 | tr -d '\n' | pnpm wrangler secret put SETUP_CODE
```
