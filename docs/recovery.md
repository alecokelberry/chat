# Recovery

What to do when something goes wrong with live Chat. Commands checked against Cloudflare's docs on Nov 28, 2026.

## Roll back a bad deploy

In the Cloudflare dashboard, open Workers & Pages › `chat` › Deployments, pick the last good version's ⋯ menu and choose Rollback. `pnpm wrangler rollback` does the same from the terminal. Any of the last 100 versions can be picked.

A rollback swaps the code only: the database keeps any migration the bad deploy ran, which is why migrations only add (`CODING_STANDARDS.md` › Migrations). The next push to `main` deploys again, so fix or revert the bad commit on `main` before anything else lands.

## Restore the database

The database holds accounts, passkeys, settings and the chat list (titles, pins, dates and Search's index). It doesn't hold the messages: each chat's messages live in its own agent, and neither way below brings them back.

- **Time Travel** puts the whole database back to a moment in the last 7 days (Workers Free). It overwrites everything written since, and prints a bookmark to undo it:

  ```sh
  pnpm wrangler d1 time-travel restore chat --timestamp=2026-11-28T09:00:00Z
  ```

- **A backup** from `pnpm db:export` (in `backups/`, on your Mac) is for anything older. README › Backups has the steps.

## Rotate a secret

Rotate one when it may have been seen. Put a live Worker secret with `pnpm wrangler secret put NAME` and a Preview one with `pnpm wrangler preview base-config secret put NAME`; each is read from the keyboard, never typed into the command. Keep `.dev.vars` on the Mac in step.

| Secret                    | Made at                                                    | Goes in                                    | Rotating it                                                 |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | Any 32+ random characters (`openssl rand -hex 32`)         | Worker: live and Previews (each its own)   | Signs everyone out                                          |
| `SETUP_CODE`              | `openssl rand -hex 24`                                     | Worker: live and Previews                  | Nothing: it's replaced after every use (README › Deploying) |
| `NVIDIA_API_KEY`          | build.nvidia.com › API keys                                | Worker: live and Previews                  | Put the new key first, then revoke the old one              |
| `AI_GATEWAY_TOKEN`        | AI Gateway "chat" › Settings (Run permission)              | Worker: live and Previews                  | Put the new token first, then delete the old one            |
| `AI_GATEWAY_URL`          | AI Gateway "chat"'s NVIDIA route                           | Worker: live and Previews                  | Only changes if the gateway does                            |
| `KEENABLE_API_KEY`        | keenable.ai                                                | Worker: live and Previews                  | Put the new key first, then revoke the old one              |
| Deploy token              | Cloudflare › My Profile › API Tokens (D1 Edit and Workers) | Worker `chat` › Settings › Builds          | Put the new token first, then delete the old one            |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` (expires about Nov 2027)              | GitHub › repo Settings › Secrets › Actions | Reviews fail once the old one expires or is revoked         |

## Locked out

If the only passkey is gone (a lost or replaced phone), add a new one with a fresh setup code: README › Deploying has the one command, run from the Mac, and the one that turns `/setup` off again after. Chats aren't touched: they belong to the account, not the passkey.
