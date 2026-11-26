# Coding standards

What `code-review` checks a diff against, on top of AGENTS.md and DESIGN.md. Each finding names what falls short and the fix. Lint, types and tests already enforce the mechanical rules, so these are the judgment calls.

## Cleanliness

**Simplicity.** The change can't get smaller without losing something it needs. List what it must do, then flag every line, branch, option, file or dependency that isn't needed for that, and every two things that could be one.

**Library first.** Code a well-maintained library already gives us isn't written by hand: before writing a table, parser, map or helper, check the packages already installed (and what they export), then a free, current, widely used one. Flag hand-written code a dependency already ships (like a language-name map Shiki has), and a new dependency the PR body doesn't name and justify.

**Modularity.** Each part has one job and a small, explicit interface: it could be moved elsewhere by reconnecting that interface alone. Flag parts that only pass things through, reach into another part's internals, depend on each other in a circle, or take more than they use.

**Abstraction.** Every concept is real, sized right, and there are few enough to hold in your head. Flag a parameter only ever given one value, an interface with one implementation, a helper used once, and two things merged only because they look alike.

**Purity.** Logic between the edges (requests, the database, the DOM) is pure: same input, same output, no hidden state. Mutation is fine where it's the clear choice (a local accumulator, a ref), but it stays local and obvious. Flag copying large data just to look pure.

**Readability.** Each function reads like a short paragraph at one level of detail. Rules live in types, constraints or data rather than in branching code. Names say what something is, in the words of `GLOSSARY.md`; inline a name that tells the reader nothing.

## Robustness

**Design simplicity.** Step back from the lines: is this the simplest design that meets the issue? Flag a mechanism where a plain function would do, state that could be derived, and work done on the server that the client already has (or the reverse).

**Security.** Correct under attack: who can call it, with what input, and what they gain. Check authentication, authorization (only the signed-in owner's data), input validation (zod at the edge), output escaping, secrets (never logged or sent to the client), cookies, CSRF, and unbounded work an attacker could trigger. Each finding names a concrete path. Flag a check that duplicates one that already exists.

**Edge cases.** Every case real use reaches (empty, one, many, very long, slow network, a reload mid-stream, two tabs, an error from NVIDIA), and rare ones whose failure would be bad (lost messages, a stuck spinner, a wrong chat). Give how likely and how bad.

**Performance.** Fast enough for Chat's real load (one person, long chats, big files): flag work that's repeated, unbounded, blocks a render or streams slowly. Also flag optimizing what that load doesn't need. Workers Free gives each request 10 ms of CPU: flag heavy server work (big SSR, hashing, parsing) that belongs in the browser. React code follows `vercel-react-best-practices`. Server code (the Worker, D1, `wrangler.jsonc`) follows `cloudflare:workers-best-practices`, and the chat agent `cloudflare:agents-sdk` and `cloudflare:durable-objects`.

**Tests.** The smallest set that gives real confidence: a smoke test per feature and a unit test for tricky logic, at the seams the ticket agreed. Every interface also gets ui-sdk's agent test (the `ui-sdk` skill's agent-ready page). e2e tests use `e2e/session.ts`'s `test`, sign-in and helpers; a second copy of a helper goes there instead. Flag a behavior change with no test, a test that can't fail, and any weakened lint, type or test check.

## UI

Polished at every size (1440 and 390), in light and dark, by mouse, touch and keyboard, with worst-case data. Follows DESIGN.md, and matches grok.com where Grok has the same part (measure it in a browser, don't guess). Flag desktop UI squeezed onto a phone, missing focus and loading states, and motion that fights the user.

**ui-sdk first.** Read `node_modules/@ui-sdk/react/docs/llms.txt`, the `ui-sdk` skill and each component's page before using it. Flag anything against DESIGN.md › Which ui-sdk part, a part, behavior or hook built by hand that ui-sdk ships, and a popup opened from a click handler where a `create*Controller()` or `payload` belongs. Every control a person can use, links included, is one `window.agent.snapshot()` lists by name: a link is a Button whose `render` is the router's `Link` (ui-sdk's Button docs › Links), never a bare `Link`. When a lint rule and ui-sdk's docs disagree, the docs win: fix the rule in its own commit.

**Skills, by what changed.** Load each that applies and say which ran, in the PR's Evidence (`Ran: …`). Most UI changes hit several rows.

| The diff touches                                                                   | Run                                        | What it catches here                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Anything that renders data: a message, title, file name, model name, count or list | `break-ui`                                 | Long and unbreakable text, one-letter and emoji names, 0, 1 and 1,000 items, missing fields, 200% zoom |
| Anything a phone shows                                                             | `mobile-native`                            | Ungated `:hover`, `vh`, inputs under 16px, tap delay, safe areas, theme color                          |
| A button, menu, popover, tooltip, toggle or field                                  | `emil-design-eng`, `web-design-guidelines` | Press and hover states, popover origin, tooltip timing, focus, accessibility                           |
| New or changed motion                                                              | `animate`, then `remove-animations`' gate  | Whether it should move at all, curve, duration, interruption, exit                                     |
| Several parts moving together (drawer and backdrop, list items, a view swap)       | `choreograph`                              | Order, overlap, what stays still                                                                       |
| A drawer, sheet, swipe or drag                                                     | `gestures`, `apple-design`                 | 1:1 tracking, interruptible, velocity on release, rubber-banding, reduced motion                       |
| Motion that stutters, or a long list or stream                                     | `animation-performance`                    | Composite-only properties, main-thread work during motion                                              |
| A new part whose look isn't settled                                                | `prototype`                                | Real directions behind a picker; Alec picks                                                            |

`review-animations` and `learn-taste` are Alec's to run.
