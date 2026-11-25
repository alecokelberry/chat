# Chat

My own AI chat on free NVIDIA models, on Cloudflare's free plan. The budget is $0: no paid service, no card, no domain. Keep it minimal: bring each piece in with the feature that needs it, and delete before adding.

The open GitHub issues are the plan, `docs/decisions.md` says why it's built this way (add a row when a decision changes), `docs/nvidia.md` covers the models, `DESIGN.md` the UI and `CODING_STANDARDS.md` what review checks. `pnpm check` before each commit, `pnpm verify` before each PR. `src/routeTree.gen.ts` and `worker-configuration.d.ts` are generated.

## Rules

- **Free plan limits:** 10 ms of CPU per request (waiting on NVIDIA doesn't count) and a Worker under 3 MB gzipped. Keep server rendering light, render heavy things (markdown, code highlighting) in the browser, and never hash passwords on the server.
- **Env** comes per request: `import { env } from "cloudflare:workers"`, never `process.env` at module scope.
- **Secrets** live only in Wrangler secrets, GitHub Actions secrets and a local `.dev.vars`. Never print, log or commit them: the repo is public.
- **AI** goes only through `src/lib/ai`. Tests use the mock model, never NVIDIA; a few real-NVIDIA smoke tests run before a deploy.
- **UI** is built on ui-sdk (follow the `ui-sdk` skill) and follows `DESIGN.md`. Check it at 1440 and 390, light and dark.
- **Docs first:** read the version-matched docs before writing against a fast-moving package (`node_modules/@ui-sdk/react/docs/llms.txt`, `node_modules/@tanstack/*/skills`, `node_modules/agents/docs`, `node_modules/ai/docs`).
- A new part gets a comment at its top saying what it is and how it works.

## How work flows

1. **Plan:** grill Alec (`grilling`, with `domain-modeling` for words and decisions), `prototype` what can't be settled on paper, then `to-spec` and `to-tickets`. An agreed issue is the go-ahead to build it; ask again only about UI direction Alec hasn't seen and anything that takes live down.
2. **Build:** `implement` one ticket per branch, test-first with `tdd`, then `code-review` against its issue and fix what it finds until a pass comes back clean. Rebase onto `origin/main` and run `pnpm verify` before the PR.
3. **Ship:** one PR per ticket, titled as a plain imperative sentence, body from the `pr` skill in the template's sections, saying `Closes #N`. The PR's thread merges with a merge commit, only after Alec's go-ahead; CI never merges. Each push to `main` deploys through Workers Builds.
4. **Learn:** `retro` after a build that went badly; `diagnosing-bugs` for a hard bug.

- Commits: one logical change each, an imperative subject in plain English (50 characters ideally, never over 72), and a body that says why. Not Conventional Commits. Fix earlier commits with `git commit --fixup` and rebase; never merge `main` in.

## Agent skills

- **Issue tracker:** GitHub issues on `alecokelberry/chat`. No labels, except the `wayfinder:*` ones wayfinder needs: skip the `ready-for-agent` label `to-spec` and `to-tickets` add by default. A spec is the parent issue and its tickets are sub-issues, with native "blocked by" links.
- **Domain docs:** single context. `GLOSSARY.md` at the root (created with the first term) and `docs/decisions.md` in place of `docs/adr/`.
- **Skills** in `.claude/skills` come from upstream through `skills-lock.json` (`npx skills update`), unmodified: conventions for them go here, not in their files. `ui-sdk` is linked from `node_modules` on install.
