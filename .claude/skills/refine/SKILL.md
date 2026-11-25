---
name: refine
description: Review and fix a branch's change in loops until a full pass changes nothing. Use before opening any Chat PR, and again before pushing new commits to an open one.
---

# Refine

Refine happens before the PR opens, so an open PR is a finished one: the project manager reviews and merges it by hand.

## Size it

| Size  | When                                                                                             | Passes                                          |
| ----- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Full  | A feature, anything in `src/lib/auth`, the data layer, the server, a dependency added or removed | Cleanliness, then robustness (both loops below) |
| Quick | Docs, config, copy, a small fix in one file                                                      | One pass of simplicity, security and edge cases |

When unsure, it's full.

## Loop

1. **The diff.** `git fetch origin main`, then `git diff origin/main...HEAD`. Every pass reads the whole diff, never just what changed since the last pass.
2. **Intended behavior.** Write it down first, from the request, in a few lines (it becomes the PR body). Every finding is judged against it.
3. **Cleanliness:** simplicity, modularity, abstraction, purity, readability.
4. **Robustness:** design simplicity, security, edge cases, UI and UX, performance, tests.

   Each standard is in [reviewers.md](reviewers.md). Read it and apply it to the diff yourself, one standard at a time; don't skip one because it "obviously" passes. For a full refine you may hand one standard to a Sonnet subagent for a read that isn't anchored on yours.

5. **Sort each finding:**
   - **Fix:** a clear right answer inside the change's scope. Fix it.
   - **Ask:** it would change behavior or the intended behavior, add or remove a dependency, or set UI direction Alec hasn't seen. Stop and ask (a side session asks the project-manager chat), with the options and your recommendation. Don't open the PR until it's answered.
   - **Drop:** not real. One line on why, in your report, not the PR.
6. **After any fix:** `pnpm check`, commit, and start the current loop again from its first standard. Don't reopen a finding you already resolved unless there's new evidence.
7. **Stop** when a full pass of both loops (or the quick pass) changes nothing.

## Finish

- Rebased on `origin/main`, and the diff is only the intended change.
- `pnpm verify` passes locally for a full refine (CI runs it either way).
- UI changed: checked per AGENTS.md (Browser pane, 1440 and 390, light and dark, `window.agent.snapshot()`, the console), and on the iPhone 18 Pro simulator against `pnpm preview` (Safari and the Home Screen app).
- Then open the PR (`gh pr create`, the intended behavior as the body) and report. The project-manager chat reviews the diff and merges it; CI verifies `main` again and deploys.
- A fix after the PR is open: refine again (quick is fine for a small one) before pushing it.
