# DESIGN.md

Quiet and warm. The sidebar, the chat and its menus are near-monochrome, and the reply is what you look at. Light and dark, one responsive layout from 390px up.

Values live in `src/styles/app.css`, and how each component works lives in a comment at the top of its file. This file holds the rules and the taste, and lint enforces what it can.

Carried over from the first Chat (alecokelberry/chat, archived). Components arrive as each feature needs them; until then a section may describe a part that isn't here yet.

## Principles

- One primary answer per screen, top left, biggest. Everything else supports it.
- Hierarchy by size and position first. Color always means something.
- Dense is fine when it's aligned. Tables beat cards for many like things.
- Reorder for phones, don't just stack.
- No alerts: no verdicts, status dots, warning badges or "slow" flags.
- A redesign changes how something is shown, not whether. Dropping something is said out loud.

## Tokens

Every value is a named token in `src/styles/app.css` (`:root`, its `dark` variant, `@theme inline`). Use the utility, never `[…]`. A new token name also goes in `createCn` in `src/lib/utils.ts` (when it lands with the first component) so `cn` merges it. Quarter steps on the 4px scale (`gap-2.75`) are on-scale.

## Colors

Semantic tokens only; no `dark:` color overrides. Everything is near-monochrome except:

- **Pink** (`send`): the send button, New Chat's plus (Grok's is blue) and selection, nothing else. Focus is the stock gray `ring`, for keyboard focus only.
- **Status** (`success`, `warning`, `destructive`): the shell's own feedback, never data.

## Type

Geist and Geist Mono, both variable. Five sizes: `text-xs` 12/16, `sm` 14/20, `base` 15/24, `2xl` 20/26 and `3xl` 28/36. Two weights: `font-normal` (425) and `font-medium` (525). Small sizes track slightly open (+0.01em at 12px), and display sizes sit at 0. App code never sets `leading-*` or `tracking-*`. Chat prose is `typeset typeset-docs` (`src/styles/`), the one place bold is used, at 650. Text fields on touch screens stay at 16px. Sizes are in rem, so they follow the browser's text size.

## Motion

Motion is quick and functional.

| What                                                                                                        | Duration                 | Curve             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------- |
| Hover and color; letting go of a press                                                                      | `duration-fast` 120ms    | `ease-standard`   |
| Pressing in (`press`: colors snap, 97% scale over 80ms, from the moment a finger lands via `data-pressing`) | 0 / 80ms                 | `ease-decelerate` |
| Menus and tooltips (`popup-motion`: fade and 95% zoom from the trigger)                                     | `duration-menu` 120ms    | `ease-decelerate` |
| Dialogs' scrims, the composer's focus                                                                       | `duration-pane` 200ms    | `ease-standard`   |
| Sidebar collapse                                                                                            | `duration-sidebar` 200ms | `ease-spring`     |
| Phone sidebar open (close: `duration-pane`)                                                                 | `duration-drawer` 300ms  | `ease-drawer`     |
| Toasts                                                                                                      | 500ms                    | `ease-out-quint`  |

- Use transitions, not keyframes, so motion can be interrupted.
- Animate only `transform`/`scale` and `opacity` on things that move.
- Keyboard-triggered actions (⌘K, send, switching chats) never animate.
- Touch feedback starts on pointerdown (`PressFeedback`, `active:` matches `data-pressing`) and lasts at least 90ms, so a quick tap on iOS always shows.
- Under reduced motion, movement and scale stop and fades stay (`press` scales only under `no-preference`).
- Durations and curves are the tokens in the table; `ui/motion-tokens` lints the rest.
- Route changes don't animate: switching chats is one of the most frequent things you do here. View transitions stay out.

## Access

WCAG 2.2 AA is the floor. Lint can't check it; axe catches some, so check the rest by hand.

- **Focus:** a solid 2px `ring` (3.5:1 light, 3.7:1 dark) on keyboard focus only, and the same 2px for an invalid field. Never a soft glow under 3:1. `outline-hidden` keeps an outline in forced colors.
- **Targets:** at least 24px. Small buttons keep their look and get a bigger invisible touch area from `::after` (40px on touch screens).
- **Text:** every word is 4.5:1, labels and placeholders included: the quietest ink is `muted-foreground` (and `sidebar-muted` for section labels), 5.0:1 light and 5.8:1 dark. Red text on a red tint is `destructive-foreground`.
- **Wrapping:** headings balance and paragraphs wrap pretty (`text-wrap`, set once in app.css).
- **Transparency:** under `prefers-reduced-transparency` nothing blurs. Panels are opaque, so menus never use `backdrop-blur`.
- **State in the URL:** a view you'd want to come back to lives in the query string, so reload, Back and links keep it.
- **Copy:** loading states and placeholders end in "…" (`Loading…`, `Ask anything…`).

## Which ui-sdk part

Every control is a ui-sdk part, so keyboards, screen readers and agents all see it. Pick from the ui-sdk skill's table; anything pressable is a Button, never a raw `<button>`, and a destructive action confirms in an AlertDialog.

- **Names:** every control has one, from its label part or `aria-label` on an icon-only one. Labels differ where they sit, so a row's menu is "Actions for <chat title>", not "Actions".
- **State:** style from `data-slot` and state attributes, and animate popups with `data-starting-style` and `data-ending-style` from `--transform-origin`. An async action returns its Promise, so the part shows `data-pending` itself.
- **Phones:** Menu, Select, Popover and Dialog take `presentation="auto"`, a sheet on a phone. The phone sidebar is a Drawer from `start`.
- **Agents:** a destructive or sending action carries `data-agent-confirm="<what it does>"`; private text carries `data-agent-hidden`. In dev, `window.agent.snapshot()` lists every control and `window.agent.act()` drives it: use it to check a screen.
- **Global parts** arrive with their first use: `Preferences` with `createColorScheme` for the theme (replacing the fixed `data-color-scheme`), `OverlayHost` for toasts and `confirm()`, `ScrollArea` with `stickToEnd` and `role="log"` for the thread.

## Screens

| Screen   | Answers                                     |
| -------- | ------------------------------------------- |
| New chat | What can I ask?                             |
| Chat     | The reply, and what the model did to get it |
| Sign-in  | One tap: your passkey                       |

## Taste

What Alec picked and why. New work starts here.

- Likes: simple and beautiful over informative-looking. Room around things. Color wherever it means something.
- Dislikes: the generic dashboard look; alerts and verdicts of any kind; glow, gradient fills, pulsing dots and other AI slop.
- One look across the app: options differ in form, never in type, color and feel. The look can change as a whole when he agrees.
- The look (Nov 20): Grok's. Warm ink (`#2c2c2b` on `#f9f8f7`, `#e6e5e3` on `#1e1d1d`) and warm alpha tints; the sidebar is the same plane as the page; menus and the composer are a raised `popover`/`surface`. The archived Chat's DESIGN.md has the per-component measurements; bring each in with its component.
- Works best: one change shown at a time, then his reaction. A direction he likes gets refined, not replaced.

## Phones

- iOS blurs the top edge unless a full-width, solid, sticky box covers it: a page's `main` is `sticky top-0 bg-background`.
- Installed, the app paints under the notch and home indicator (`viewport-fit=cover`): a full-screen page pads with `safe-area` instead of `p-4`, and `theme-color` gives the status bar the page's `background`.
- Text fields are at least 16px on touch screens, so iOS never zooms on focus.
- Heights against the viewport are `svh` or `dvh`, never `vh`, which jumps when the iPhone keyboard opens.
- Hover never changes anything on touch. Every `:hover` sits under `@media (hover: hover)` (Tailwind's `hover:` already does; hand-written CSS must too). iOS treats a tap that changes the look on hover as a hover and drops the click, so it takes two taps.
- Playwright can't emulate safe areas or the keyboard. Measure, then have Alec check on the phone.

## Never

- Arbitrary values, raw colors or `style={}` outside `src/components/ui`. Add a token or a variant.
- `className` overrides of a component's color, type, spacing or shape in app code.
- A hand-rolled control, `role=` or animation when ui-sdk ships one.
- A second theme.

`pnpm lint` enforces this (@shadcn/lint and `lint/ui-plugin.js`).
