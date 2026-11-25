# The road to v1

One PR per step. Each step ends with `pnpm verify` green.

| Step | What                                                                                                                                                                                               | Done when                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1    | Scaffold: TanStack Start on the Cloudflare plugin, Tailwind 4 and the tokens, oxlint/oxfmt with the design rules, Playwright, CI (Vitest arrives with the first unit test)                         | A page renders and CI is green       |
| 2    | Passkey sign-in (Better Auth on D1, Drizzle). `rpID` is the full `*.workers.dev` host, since workers.dev is a public suffix. A local-only dev sign-in; e2e uses Playwright's virtual authenticator | Only a signed-in passkey reaches `/` |
| 3    | Streaming chat: one `AIChatAgent` per chat, the AI SDK on NVIDIA (the four Nemotron models), the mock model in tests                                                                               | A reply streams on dev and in e2e    |
| 4    | Saved history: the chat list in D1, the sidebar, open a chat                                                                                                                                       | Reload shows the chat and the list   |
| 5    | Resume: reload mid-reply picks the stream back up                                                                                                                                                  | An e2e test reloads mid-stream       |
| 6    | Deploy: CI deploys a green `main` to workers.dev; a real-NVIDIA smoke test before each deploy                                                                                                      | Live answers on workers.dev          |

## What Alec does

1. Sign up at dash.cloudflare.com, Free plan, no card. Choose the workers.dev subdomain carefully: passkeys are tied to it.
2. `pnpm wrangler login` in this folder.
3. Before step 6: an API token from the "Edit Cloudflare Workers" template, saved as the `CLOUDFLARE_API_TOKEN` GitHub secret.
4. After the first deploy: register the passkey on the live site.
