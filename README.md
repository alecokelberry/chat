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
KEENABLE_API_KEY=<from keenable.ai (keen_…), or anything with MOCK_MODEL=1>
```

`DEV_SIGN_IN=1` shows "Sign in as Dev" on `/sign-in`, on localhost only. `MOCK_MODEL=1` answers with the mock model instead of NVIDIA; leave it out to talk to Super through the AI Gateway.

## Tests

`pnpm e2e` builds and runs the browser tests on the mock model; they never call NVIDIA. Before a deploy that touches chat, `pnpm smoke` sends one real message to Super through the AI Gateway, with the three NVIDIA and gateway values exported in the shell (not just in `.dev.vars`). The request then shows in the gateway's logs.

## Deploying

Every push to `main` deploys through Cloudflare Workers Builds, which runs `pnpm run deploy`: it builds, applies new migrations to the live database and deploys to chat.alecokelberry.workers.dev. Run it by hand only if Workers Builds is down.

The Worker needs six secrets, live and for Previews, and a deploy fails while one is missing: `BETTER_AUTH_SECRET`, `SETUP_CODE`, `NVIDIA_API_KEY`, `AI_GATEWAY_URL` (the AI Gateway "chat"'s NVIDIA route, as in `.dev.vars` above), `AI_GATEWAY_TOKEN` (made on the gateway's Settings page, with Run permission) and `KEENABLE_API_KEY` (web search: keenable.ai's free plan, 100,000 searches a month, no card).

Every push to another branch builds a Preview with `pnpm run deploy:preview`, and Workers Builds comments its address on the PR: `<branch>-chat.alecokelberry.workers.dev`. Previews share the `chat-preview` database, which gets the branch's migrations, and their own secrets, never the live ones. Each side has its own passkey, so your phone offers one at a time: live's belongs to `chat.alecokelberry.workers.dev`, and one passkey belonging to `alecokelberry.workers.dev` signs in on every Preview. Add each once (the setup code below, with `pnpm wrangler preview base-config secret put SETUP_CODE` and a Preview's address for a Preview). Sign-in offers only the passkeys the server knows, so a stale one on the phone doesn't appear.

To add a passkey while signed out (a new device), this sets a fresh setup code and opens `/setup` with it, without showing the code:

```bash
code=$(openssl rand -hex 24); printf %s "$code" | pnpm wrangler secret put SETUP_CODE && open "https://chat.alecokelberry.workers.dev/setup#$code"
```

Afterwards, turn `/setup` off again by replacing the code with one nobody knows (the sign-in request carries it to the server, so a used code is spent). Don't delete it: Wrangler won't deploy without it.

```bash
openssl rand -hex 24 | tr -d '\n' | pnpm wrangler secret put SETUP_CODE
```

## When live breaks

Look here, in this order:

1. **Issues**: the Worker's Issues page in the Cloudflare dashboard (Workers & Pages › chat › Issues) groups its failures, each with a stack trace and when it last happened.
2. **Logs**: the Worker's Observability tab holds every request's log lines and trace for 7 days (3 until Dec 1). Past 0.5 GB a day, shared with Issues, nothing is recorded until 00:00 UTC, so a gap in the logs can mean the cap was reached.
3. **AI Gateway**: AI › AI Gateway › chat › Logs shows each NVIDIA request with its status, tokens and time, for a reply that failed or hung.
4. **Workers Builds**: Workers & Pages › chat › Deployments › Builds holds each deploy's build log, for a deploy that failed.
5. **The hourly check** (planned, #235): once it lands, its runs in GitHub's Actions tab show when live last answered.

## Backups

`pnpm db:export` backs up the live D1 database to `backups/` (ignored, never committed; keep it somewhere private), and `pnpm db:export --local` the local one. The live database can't answer queries while it runs (seconds at today's size), so run it when nobody's chatting. The file is data only: the chat list, accounts, sessions and passkeys, settings, usage, and Search's copy of each message's text. It doesn't hold the chats' messages or attachments, which live in each chat's own agent (a Durable Object).

D1 also keeps its own history for 7 days on the free plan (Time Travel), which is the way back from a bad write or migration. A backup is for anything older, or a database that's gone. Make a new database named `chat`, put its id in `wrangler.jsonc`'s `database_id`, then:

```bash
pnpm wrangler d1 migrations apply chat --remote
pnpm wrangler d1 execute chat --remote --file backups/<file>.sql
```

The migrations make the tables, and as the rows go in, the triggers rebuild Search's index. Then deploy.
