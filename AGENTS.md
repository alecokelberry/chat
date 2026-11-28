# Chat

My own AI chat on free NVIDIA models, on Cloudflare's free plan. The budget is $0: no paid service, no card, no domain. Keep it minimal: bring each piece in with the feature that needs it, and delete before adding.

The open GitHub issues are the plan, `docs/decisions.md` says why it's built this way (add a row when a decision changes), `docs/nvidia.md` covers the models, `DESIGN.md` the UI and `CODING_STANDARDS.md` what review checks. `pnpm check` before each commit, `pnpm verify` before each PR. `src/routeTree.gen.ts` and `worker-configuration.d.ts` are generated.

## Rules

- **Free plan limits:** 10 ms of CPU per request (waiting on NVIDIA doesn't count) and a Worker under 3 MB gzipped. Keep server rendering light, render heavy things (markdown, code highlighting) in the browser, and never hash passwords on the server.
- **Env** comes per request: `import { env } from "cloudflare:workers"` (fine at startup too), never `process.env` at module scope.
- **Secrets** live only in Wrangler secrets, GitHub Actions secrets and a local `.dev.vars`. Never print, log or commit them: the repo is public.
- **AI** goes only through `src/lib/ai`. Tests use the mock model, never NVIDIA; a few real-NVIDIA smoke tests run before a deploy.
- **UI** is built on ui-sdk (follow the `ui-sdk` skill) and follows `DESIGN.md`. Check it at 1440 and 390, light and dark. Check list and thread changes against `?data=worst` at 390 (dev only; `src/lib/dev/worst-case.ts`).
- **Docs first:** read the version-matched docs before writing against a fast-moving package (`node_modules/@ui-sdk/react/docs/llms.txt`, `node_modules/@tanstack/*/skills`, `node_modules/agents/docs`, `node_modules/ai/docs`).
- A new part gets a comment at its top saying what it is and how it works.

## How work flows

1. **Plan:** grill Alec (`grilling`, with `domain-modeling` for words and decisions), `prototype` what can't be settled on paper, then `to-spec` and `to-tickets`. An agreed issue is the go-ahead to build it; ask again only about UI direction Alec hasn't seen and anything that takes live down.
   - **Tickets that run at once:** each ticket lists the files it expects to change. Shared pieces two tickets would both add (a test helper, a mock reply, a CSS utility, a model map, a `components/ui` part) become their own small ticket that lands first and blocks the rest. Two tickets that change the same file get a "blocked by" link instead of running together. At most three build threads run at once, and each PR merges once it's approved, not in a batch.
   - **Small visual tweaks skip planning.** A tweak changes only styles, tokens, classes or non-interactive copy (text that isn't a control's label or accessible name), in at most 3 files and about 60 changed lines (tests and screenshots don't count). Alec's ask is the go-ahead: build it on a branch and open a PR whose body says what changed and why in place of `Closes #N`. It still runs `pnpm verify`, carries screenshots (390 light, 1440 dark) and gets the one review. Anything touching the server, data, behavior, accessibility roles or names, or adding a component is not a tweak. A tweak that outgrows the limit stops and goes through grilling, spec and tickets first.
2. **Build:** before writing code, read the ui-sdk docs for each part it uses and how the archived Chat (`alecokelberry/chat-archive`, a reference, not a spec) did the same thing. `implement` one ticket per branch, test-first with `tdd`, using the skills `CODING_STANDARDS.md` lists for what changed. Don't run `code-review` or `security-review` yourself: the PR gets one review on GitHub (Ship). Rebase onto `origin/main` and run `pnpm verify` before the PR.
3. **Ship:** one PR per ticket (or per small visual tweak), titled as a plain imperative sentence, body from the `pr` skill in the template's sections, saying `Closes #N` (a tweak says what changed and why instead). Alec's standing go covers a green PR whose review is addressed; live data, secrets and iPhone feel checks still need him. The PR's thread brings the branch up to date and turns on auto-merge; GitHub squash-merges it once `verify` passes. The `review` workflow reviews each PR once, when it opens, and `review.yml` says which files get Opus and `security-review`. Fix its real findings in one round, with no re-review. Each push to `main` deploys through Workers Builds.
4. **Learn:** `retro` after a build that went badly; `diagnosing-bugs` for a hard bug; `cloudflare:workers-profiling` when live CPU goes over 10 ms; `cloudflare:web-perf` for a slow load or a laggy phone.

- Tests: while iterating, run only the affected spec (`pnpm e2e <file>`) or unit test (`pnpm test <file>`); the full suite runs once, in `pnpm verify`. Unit tests are Vitest in Node, for pure logic only, beside the module (`*.test.ts`); a rule that must hold for every input is a fast-check property (`it.prop`), with inputs spread wide enough to reach the edge (fast-check's doubles cluster near 0).
- Flaky tests: a test that passes and fails on the same code has a cause, in the app or the test; find it and fix it there. A wait waits on what the page shows, or on `settled()` (`e2e/session.ts`) for a check that something didn't happen; lint stops `waitForTimeout`. When no cause turns up, delete the test and say why in the PR. Skipping, retrying or sleeping hides the cause, so none of them is a fix.
- Commits: one logical change each, an imperative subject in plain English (50 characters ideally, never over 72), and a body that says why. Not Conventional Commits. `main` gets one commit per PR, made from its title and body, so those follow the same rules.

## Agent skills

- **Issue tracker:** GitHub issues on `alecokelberry/chat`. No labels, except the `wayfinder:*` ones wayfinder needs: skip the `ready-for-agent` label `to-spec` and `to-tickets` add by default. A spec is the parent issue and its tickets are sub-issues, with native "blocked by" links.
- **Domain docs:** single context. `GLOSSARY.md` at the root (created with the first term) and `docs/decisions.md` in place of `docs/adr/`.
- **Skills** in `.claude/skills` come from upstream through `skills-lock.json`, unmodified except one line: `implement`, `to-spec`, `to-tickets`, `retro` and `wayfinder` drop upstream's `disable-model-invocation`, so threads load them with the Skill tool. Update with `pnpm skills:update`, which strips it again. Conventions for them go here, not in their files. `ui-sdk` is linked from `node_modules` on install. Skills from `chat-archive` (like `refine`) belong to the old app; review here is `code-review` against `CODING_STANDARDS.md`.
