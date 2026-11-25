# Chat

My own AI chat on free NVIDIA models, on Cloudflare's free plan. The budget is $0: no paid service, no card, no domain. Keep it minimal: bring each piece in with the feature that needs it, and delete before adding.

`docs/plan.md` is the road to v1, `docs/decisions.md` says why it's built this way (add a row when a decision changes), `docs/nvidia.md` covers the models, and `DESIGN.md` the UI. `pnpm check` before each commit, `pnpm verify` before each PR. `src/routeTree.gen.ts` and `worker-configuration.d.ts` are generated.

## Rules

- **Free plan limits:** 10 ms of CPU per request (waiting on NVIDIA doesn't count) and a Worker under 3 MB gzipped. Keep server rendering light, render heavy things (markdown, code highlighting) in the browser, and never hash passwords on the server.
- **Env** comes per request: `import { env } from "cloudflare:workers"`, never `process.env` at module scope.
- **Secrets** live only in Wrangler secrets, GitHub Actions secrets and a local `.dev.vars`. Never print, log or commit them: the repo is public.
- **AI** goes only through `src/lib/ai`. Tests use the mock model, never NVIDIA; a few real-NVIDIA smoke tests run before a deploy.
- **UI** is built on ui-sdk and follows `DESIGN.md`. Check it at 1440 and 390, light and dark.
- **Docs first:** read the version-matched docs before writing against a fast-moving package (`node_modules/@tanstack/*/skills`, `node_modules/agents/docs`, `node_modules/ai/docs`).
- A new part gets a comment at its top saying what it is and how it works.

## How Claude works here

- Use your judgment: fixes, refactors, deletions, tooling, tests and these docs are yours. Ask only about UI direction I haven't seen and anything that takes live down. Bundle related questions into one proposal.
- Commits: one logical change each, an imperative subject in plain English (50 characters ideally, never over 72), and a body that says why. Not Conventional Commits.
- PRs: one feature or fix each, titled as a plain imperative sentence, with the template as the body. Run the `refine` skill first. Fix earlier commits with `git commit --fixup` and rebase onto `origin/main`; never merge `main` in. CI never merges: the project-manager chat merges with `gh pr merge <n> --merge --delete-branch` after reading the diff.
- Once per clone: `git config core.hooksPath .githooks`.
