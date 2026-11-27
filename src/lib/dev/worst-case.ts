// Made-up data for checking screens against extremes, in dev and e2e builds
// only: ?data=worst, ?data=empty or ?data=one on any signed-in page swaps the
// sidebar's chats, the account row and a chat's messages for fixtures, and a
// bar at the bottom (components/ui/demo-bar.tsx) flips between them. The
// swap happens where each piece of data enters (the layout's chat list and
// account, a chat's messages: src/routes/_app), so no component knows. A
// production or Preview build compiles the whole thing away and ignores the
// parameter. Fixture chats are not in the database, so a rename, pin or
// delete on one fails with its usual error toast, as it should. The values are ones a real chat could hold or the limits it
// enforces (TITLE_MAX), as break-ui's catalog suggests.
import type { UIMessage } from "ai"

import type { Account } from "@/components/chat/account-menu"
import type { ChatSummary } from "@/lib/chat/store"
import { devBuild } from "@/lib/dev/dev-build"

export const DATA_STATES = ["worst", "empty", "one"] as const
export type DataState = (typeof DATA_STATES)[number]

export const previewEnabled = devBuild

/** The state `?data=` names, or undefined: no value, an unknown one, or a
 *  build that ignores it. */
export function parseDataState(value: unknown): DataState | undefined {
  if (!previewEnabled) return undefined
  return DATA_STATES.find((state) => state === value)
}

const TITLES: (string | null)[] = [
  "Supercalifragilisticexpialidocious-and-then-some-unbreakable-title-with-no-spaces-at-all",
  // The longest title a rename keeps: 200 characters.
  "Planning the quarterly launch of the new onboarding flow with design, engineering, support and legal, including the rollout, the fallback plan, the metrics we'll watch and who answers the phone when something breaks at night".slice(
    0,
    200
  ),
  "نقاش طويل حول إعدادات الخصوصية والأمان في التطبيق",
  "王秀英と東京の旅行計画についての長い会話のタイトルがここに入ります",
  "👩🏽‍💻 Priya's 🦊 launch plan 🚀🚀🚀",
  "J",
  "<script>alert(1)</script> &amp; **bold** `code`",
  null,
  "https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments",
  "  Sam   Lee's   notes  ",
]

function fakeChats(count: number, now: number): ChatSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-a000-${String(i + 1).padStart(12, "0")}`,
    title: i < TITLES.length ? (TITLES[i] ?? null) : `Worst-case chat ${i + 1}`,
    // The first three are pinned, so Pinned holds the longest titles.
    pinned: i < 3,
    // An hour apart, from now back: Today through Older.
    updatedAt: now - i * 3_600_000,
  }))
}

/** `chats`, or the fixture's. */
export function previewChats(
  chats: ChatSummary[],
  state: DataState | undefined
): ChatSummary[] {
  const now = Date.now()
  if (!previewEnabled || state === undefined) return chats
  if (state === "empty") return []
  if (state === "one")
    return [
      {
        id: "00000000-0000-4000-a000-000000000001",
        title: "The only chat",
        pinned: false,
        updatedAt: now,
      },
    ]
  return fakeChats(1000, now)
}

/** `account`, or the fixture's: the longest name and email, or the shortest.
 *  Empty has no account to remove, so it keeps the real one. */
export function previewAccount(
  account: Account,
  state: DataState | undefined
): Account {
  if (!previewEnabled) return account
  if (state === "worst")
    return {
      name: "Aleksandra Wiśniewska-Kowalczyk",
      email: "bartholomew.fitzgerald@northwind-industries-holdings.example.com",
    }
  if (state === "one") return { name: "J", email: "a@b.test" }
  return account
}

const LONG_LINE =
  "const result = await fetchEverythingAboutTheUserAndTheirWorkspace({ userId, workspaceId, includeArchived: true, includeDeleted: true, expand: ['members', 'projects', 'documents', 'comments'] })"

const REPLY = `# A very long reply

Here is a long paragraph with a link that has no spaces to break at: https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved&sort=updated-descending. Emoji 👩🏽‍💻🦊🚀 and \`aVeryLongInlineCodeIdentifierThatHasNoSpacesInItAtAll_andKeepsGoing\` sit in the same line.

\`\`\`ts
${LONG_LINE}
\`\`\`

| Name | Email | Role | Team | Region | Plan | Seats | Status | Last seen | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Aleksandra Wiśniewska-Kowalczyk | bartholomew.fitzgerald@northwind-industries-holdings.example.com | Senior Product Design Engineer, Platform Infrastructure | Platform | EU | Enterprise | 1,284 | Invitation expired 12 days ago | 2026-11-26 | Benachrichtigungseinstellungen |
| J | a@b.test | — | — | — | — | 1 | — | — | — |

نقاش طويل حول إعدادات الخصوصية والأمان في التطبيق، مع نص عربي يمتد على أكثر من سطر واحد ليظهر كيف يتعامل التخطيط مع الاتجاه من اليمين إلى اليسار.

- A list item
  - A nested one with 王秀英と東京の旅行計画 in it
    - And one deeper still

${Array.from(
  { length: 40 },
  (_, i) =>
    `Paragraph ${i + 1}: the quick brown fox jumps over the lazy dog, then keeps going so the reply runs far past one screen and the thread has to scroll.`
).join("\n\n")}`

const message = (
  id: string,
  role: "user" | "assistant",
  text: string,
  metadata?: unknown
): UIMessage => ({ id, role, parts: [{ type: "text", text }], metadata })

/** `messages`, or the fixture's thread. */
export function previewMessages(
  messages: UIMessage[],
  state: DataState | undefined
): UIMessage[] {
  const now = Date.now()
  if (!previewEnabled || state === undefined) return messages
  const meta = { model: "super", started: now - 12_000, ms: 12_000 }
  if (state === "empty") return []
  if (state === "one")
    return [
      message("worst-1", "user", "Hi"),
      message("worst-2", "assistant", "Hello!", meta),
    ]
  return [
    message(
      "worst-1",
      "user",
      `Can you explain ${"https://example.com/a/very/long/path/with/no/spaces/".repeat(4)} and what ${"Benachrichtigungseinstellungen".repeat(3)} means? ${"This question runs on for a while. ".repeat(12)}`
    ),
    message("worst-2", "assistant", REPLY, meta),
    message("worst-3", "user", "ما هو أفضل وقت لإطلاق المنتج؟ 🚀"),
    message("worst-4", "assistant", "Short answer: 🦊", {
      ...meta,
      model: "ultra",
    }),
  ]
}
