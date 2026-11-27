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

- **Pink** (`send`): the send button, New Chat's plus (Grok's is blue), the sign-in pill's go circle and selection, nothing else. Focus is the stock gray `ring`, for keyboard focus only.
- **Status** (`destructive`): the shell's own feedback, never data. A success or warning color comes back with the first feature that needs one.

## Type

Geist and Geist Mono, both variable. Five sizes: `text-xs` 12/16, `sm` 14/20, `base` 15/24, `2xl` 20/26 and `3xl` 28/36. Two weights: `font-normal` (425) and `font-medium` (525). Small sizes track slightly open (+0.01em at 12px), and display sizes sit at 0. App code never sets `leading-*` or `tracking-*`. Chat prose is `typeset typeset-docs` (`src/styles/`), the one place bold is used, at 650. Text fields on touch screens stay at 16px. Sizes are in rem, so they follow the browser's text size.

## Motion

Motion is quick and functional.

| What                                                                                                        | Duration                 | Curve             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------- |
| Hover and color; letting go of a press                                                                      | `duration-fast` 120ms    | `ease-standard`   |
| Pressing in (`press`: colors snap, 97% scale over 80ms, from the moment a finger lands via `data-pressing`) | 0 / 80ms                 | `ease-decelerate` |
| Menus and tooltips (`popup-motion`: fade and 95% zoom from the trigger)                                     | `duration-menu` 120ms    | `ease-decelerate` |
| Dialogs' scrims                                                                                             | `duration-pane` 200ms    | `ease-standard`   |
| Sidebar collapse                                                                                            | `duration-sidebar` 200ms | `ease-spring`     |
| A reply step opening (`transition-collapse`: its height, measured by ui-sdk's Collapsible)                  | `duration-pane` 200ms    | `ease-standard`   |
| Phone sidebar (ui-sdk's Drawer: it follows the finger and settles on its own iOS spring)                    | spring                   | spring            |
| Toasts (`toast-stack`: slide in from their edge, leave the way they're swiped)                              | `duration-toast` 500ms   | `ease-out-quint`  |
| An icon swap, like Copy turning into a check (`transition-swap`: fade and scale)                            | `duration-base` 180ms    | `ease-standard`   |
| The theme's sun and moon trading places (`transition-spin`)                                                 | `duration-spin` 300ms    | `ease-standard`   |
| A chevron turning as its part opens                                                                         | `duration-fast` 120ms    | `ease-standard`   |
| Jump to latest (fade, 95% zoom and a rise, like a menu)                                                     | `duration-menu` 120ms    | `ease-decelerate` |

- Use transitions, not keyframes, so motion can be interrupted. The exception is a loop that shows work under way (the spinner, the "Thinking" shimmer, a streaming reply's caret breathing once a second), which nothing interrupts. Under reduced motion these loops hold still.
- Animate only `transform`/`scale` and `opacity` on things that move. The exceptions are a Collapsible's height, the way ui-sdk animates it, and the computer's sidebar width, which moves the chat beside it.
- Keyboard-triggered actions (⌘K, send, switching chats, switching the theme) never animate: a theme change snaps every color at once (`ui/preferences.tsx`).
- Touch feedback starts on pointerdown (`ui/press-feedback.tsx`, mounted once by the root; `active:` matches `data-pressing`) and lasts at least 90ms, so a quick tap on iOS always shows. A scroll taking over or a finger sliding 12px off the control lets it go.
- Under reduced motion, movement and scale stop and fades stay (`press` scales only under `no-preference`; a toast fades where it sits).
- Durations and curves are the tokens in the table; `ui/motion-tokens` lints the rest.
- Route changes don't animate: switching chats is one of the most frequent things you do here. View transitions stay out.

## Access

WCAG 2.2 AA is the floor. Lint can't check it; axe catches some, so check the rest by hand.

- **Audits:** `e2e/a11y.spec.ts` scans sign-in, a new chat, a markdown reply and the account menu with axe, in light and dark at 1440 and 390, and fails on serious or critical WCAG 2.2 AA problems. A new screen adds itself to it when it lands.

- **Focus:** a solid 2px `ring` (3.5:1 light, 3.7:1 dark) on keyboard focus only, and the same 2px for an invalid field. Never a soft glow under 3:1. `outline-hidden` keeps an outline in forced colors.
- **Skip to content:** the first Tab on a signed-in page shows a pill at the top left that moves focus to the page's `<main id="main">` (`ui/skip-link.tsx`). A new signed-in page's `main` takes `id="main" tabIndex={-1}`.
- **Targets:** at least 24px. Small buttons keep their look and get a bigger invisible touch area from `::after` (40px on touch screens).
- **Text:** every word is 4.5:1, labels and placeholders included: the quietest ink is `muted-foreground` (and `sidebar-muted` for section labels), 5.0:1 light and 5.8:1 dark. Red text on a red tint is `destructive-foreground`.
- **Wrapping:** headings balance and paragraphs wrap pretty (`text-wrap`, set once in app.css).
- **Transparency:** under `prefers-reduced-transparency` nothing blurs. Panels are opaque, so menus never use `backdrop-blur`.
- **State in the URL:** a view you'd want to come back to lives in the query string, so reload, Back and links keep it.
- **Copy:** loading states and placeholders end in "…" (`Loading…`, `Ask anything…`).

## Which ui-sdk part

Every control is a ui-sdk part, so keyboards, screen readers and agents all see it. Pick from the ui-sdk skill's table; anything pressable is a Button, never a raw `<button>`, and a destructive action offers Undo in a toast instead of a confirm (Delete), or confirms in an AlertDialog where nothing can be put back.

- **Names:** every control has one, from its label part or `aria-label` on an icon-only one. Labels differ where they sit, so a row's menu is "Actions for <chat title>", not "Actions".
- **State:** style from `data-slot` and state attributes, and animate popups with `data-starting-style` and `data-ending-style` from `--transform-origin`. An async action returns its Promise, so the part shows `data-pending` itself.
- **Phones:** Menu, Select, Popover and Dialog take `presentation="auto"`, a sheet on a phone. A Dialog's sheet holding a text field (Search) is nearly the visible height (`sheet-tall`) and is lifted above the keyboard by ui-sdk. A sheet moves only by ui-sdk's own translate: no fade, zoom, shadow or blur of ours animates while it slides (the archived Chat's sheets felt laggy on an iPhone). Menu and Select sheets sit on the screen's bottom edge, never lifted for a keyboard (they hold no text field). The one shadow is still: `sheet-bleed` carries the sheet's fill far past its bottom edge, so iOS's bounce on a drag up shows more sheet, never the page. The phone sidebar is a Drawer from `start`.
- **Lists of options:** a listbox (Search's Command) holds only options. A result's … (CommandRow) is for the pointer: hidden from assistive tech and out of the tab order, since the sidebar's row and the chat's header hold the same actions; its menu renders outside the list, and a rename takes the search field's place (CommandFieldEdit).
- **Agents:** a destructive or sending action carries `data-agent-confirm="<what it does>"`; private text carries `data-agent-hidden`. In dev, `window.agent.snapshot()` lists every control and `window.agent.act()` drives it: use it to check a screen.
- **Attachments:** the + at the composer's start is a Menu (a sheet on a phone) whose one row opens the picker; paste and a drop anywhere on the page add files too, a dimmed overlay saying "Drop to attach" while files are dragged. Attached files are FileInput items above the text: 56px tiles with 12px corners (an image's thumbnail, a document's 176px FileChip), each with a 20px ✕ on its top corner, in a row that scrolls sideways and fades at its ends, never widening the composer. A sent question shows its images as 64px (80px on a computer) thumbnail Buttons above the bubble, each opening an ImageViewer (a Dialog sized to the image, a sheet on a phone), and its documents as FileChips. A long file name gives way in the middle, keeping its end.
- **Global parts** arrive with their first use: `Preferences` with `createColorScheme` for the theme (replacing the fixed `data-color-scheme`), `OverlayHost` for toasts (`ui/toast.tsx`: always dark, 356px at the bottom right, at the top on a phone, no close button) and later `confirm()`, `ScrollArea` under the thread's `MessageScroller` (`role="log"`), which opens at your last message rather than sticking to the end.

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

- iOS blurs the top edge unless a full-width, solid, sticky box covers it: a page's `main` is `sticky top-0 bg-background`, or, in the signed-in app, the shell around it (`chat-sidebar.tsx`). iOS 26 and later color the status bar from that box, not `theme-color`, in Safari and the Home Screen app alike, and sample it again only when a fixed or sticky element comes or goes, never while anything in the top layer shows. So a theme change shows a plain strip for one frame with the drawer and menu hidden, and iOS fades the bar to the new color, with no reload (`ui/preferences.tsx`); `e2e/status-bar.ts` models the rules. At launch the Home Screen app reads `theme-color`, so the server writes the saved theme's color (a `theme` cookie, `lib/theme.ts`).
- Installed, the app paints under the notch and home indicator (`viewport-fit=cover`): a full-screen page pads with `safe-area` instead of `p-4`, and `theme-color` gives other browsers' bars the page's `background`.
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
