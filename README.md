# Chat

My own AI chat on free NVIDIA models, running on Cloudflare's free plan. A personal project: see `AGENTS.md` for how it's built and the open issues for where it's going.

## Running it locally

Make a `.dev.vars` like this, then `pnpm wrangler d1 migrations apply chat --local` and `pnpm dev`:

```
BETTER_AUTH_SECRET=<any 32+ characters>
SETUP_CODE=<anything; /setup#<it> adds a passkey>
DEV_SIGN_IN=1
PASSKEY_RP_ID=localhost
MOCK_MODEL=1
NVIDIA_API_KEY=<from build.nvidia.com, or anything with MOCK_MODEL=1>
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/<account id>/chat/custom-nvidia/v1
AI_GATEWAY_TOKEN=<the gateway's token, or anything with MOCK_MODEL=1>
```

`DEV_SIGN_IN=1` shows "Sign in as Dev" on `/sign-in`, on localhost only. `MOCK_MODEL=1` answers with the mock model instead of NVIDIA; leave it out to talk to Super through the AI Gateway.

## Tests

`pnpm e2e` builds and runs the browser tests on the mock model; they never call NVIDIA. Before a deploy that touches chat, `pnpm smoke` sends one real message to Super through the AI Gateway, with the three NVIDIA and gateway values exported in the shell (not just in `.dev.vars`). The request then shows in the gateway's logs.

## Deploying

Every push to `main` deploys through Cloudflare Workers Builds, which runs `pnpm run deploy`: it builds, applies new migrations to the live database and deploys to chat.alecokelberry.workers.dev. Run it by hand only if Workers Builds is down.

The Worker needs five secrets, live and for Previews, and a deploy fails while one is missing: `BETTER_AUTH_SECRET`, `SETUP_CODE`, `NVIDIA_API_KEY`, `AI_GATEWAY_URL` (the AI Gateway "chat"'s NVIDIA route, as in `.dev.vars` above) and `AI_GATEWAY_TOKEN` (made on the gateway's Settings page, with Run permission).

Every push to another branch builds a Preview with `pnpm run deploy:preview`, and Workers Builds comments its address on the PR: `<branch>-chat.alecokelberry.workers.dev`. Previews share the `chat-preview` database, which gets the branch's migrations, and their own secrets, never the live ones. Each side has its own passkey, so your phone offers one at a time: live's belongs to `chat.alecokelberry.workers.dev`, and one passkey belonging to `alecokelberry.workers.dev` signs in on every Preview. Add each once (the setup code below, with `pnpm wrangler preview base-config secret put SETUP_CODE` and a Preview's address for a Preview).

To add a passkey while signed out (a new device), this sets a fresh setup code and opens `/setup` with it, without showing the code:

```bash
code=$(openssl rand -hex 24); printf %s "$code" | pnpm wrangler secret put SETUP_CODE && open "https://chat.alecokelberry.workers.dev/setup#$code"
```

Afterwards, turn `/setup` off again by replacing the code with one nobody knows. Don't delete it: Wrangler won't deploy without it.

```bash
openssl rand -hex 24 | tr -d '\n' | pnpm wrangler secret put SETUP_CODE
```
