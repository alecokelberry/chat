import { fc, it } from "@fast-check/vitest"
import { expect } from "vitest"

import { groupChats, sortChats, type ChatSort } from "@/lib/chat/groups"

// Runs in America/New_York (vitest.config.ts), so the days around a
// daylight saving change, 23 and 25 hours long, are in range.
const DAY = 86_400_000
const now = fc.integer({
  min: Date.UTC(2024, 0, 1),
  max: Date.UTC(2028, 0, 1),
})

type Chat = {
  id: number
  pinned: boolean
  updatedAt: number
  createdAt: number
}

/** Chats active within 30 days either side of `at`, each with an id. */
const chatsAround = (at: number) =>
  fc
    .array(
      fc.record({
        pinned: fc.boolean(),
        updatedAt: fc.integer({ min: at - 30 * DAY, max: at + DAY }),
        createdAt: fc.integer({ min: at - 30 * DAY, max: at + DAY }),
      }),
      { maxLength: 40 }
    )
    .map((chats) => chats.map((chat, id): Chat => ({ id, ...chat })))

const by = fc.constantFrom<ChatSort>("updatedAt", "createdAt")
const world = now.chain((at) => fc.tuple(fc.constant(at), chatsAround(at), by))

/** Calendar days from `then` to `at` in local time, counted on the
 *  calendar rather than in 24-hour steps. */
function daysBetween(then: number, at: number) {
  const day = (time: number) => {
    const date = new Date(time)
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  }
  return Math.round((day(at) - day(then)) / DAY)
}

function expectedGroup(chat: Chat, at: number, key: ChatSort) {
  if (chat.pinned) return "Pinned"
  const days = daysBetween(chat[key], at)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days <= 7) return "Previous 7 days"
  return "Older"
}

it.prop([world])("puts every chat in exactly one group", ([at, chats, key]) => {
  const shown = groupChats(chats, at, key).flatMap((group) => group.chats)
  expect(shown.map((chat) => chat.id).toSorted((a, b) => a - b)).toEqual(
    chats.map((chat) => chat.id)
  )
})

it.prop([world])(
  "groups by local calendar day, pinned chats only under Pinned",
  ([at, chats, key]) => {
    for (const group of groupChats(chats, at, key)) {
      for (const chat of group.chats) {
        expect(group.label).toBe(expectedGroup(chat, at, key))
      }
    }
  }
)

it.prop([world])(
  "keeps the groups in order, with no empty one, and the list's order inside each",
  ([at, chats, key]) => {
    const groups = groupChats(chats, at, key)
    const order = ["Pinned", "Today", "Yesterday", "Previous 7 days", "Older"]
    const labels: string[] = groups.map((group) => group.label)
    expect(labels).toEqual(order.filter((label) => labels.includes(label)))
    for (const group of groups) {
      expect(group.chats.length).toBeGreaterThan(0)
      const ids = group.chats.map((chat) => chat.id)
      expect(ids).toEqual(ids.toSorted((a, b) => a - b))
    }
  }
)

it.prop([world])(
  "sorts pins first, then newest first, keeping ties in the list's order",
  ([, chats, key]) => {
    const sorted = sortChats(chats, key)
    expect(sorted.map((chat) => chat.id).toSorted((a, b) => a - b)).toEqual(
      chats.map((chat) => chat.id)
    )
    for (const [i, chat] of sorted.entries()) {
      const next = sorted[i + 1]
      if (next === undefined) continue
      expect(Number(chat.pinned)).toBeGreaterThanOrEqual(Number(next.pinned))
      if (chat.pinned !== next.pinned) continue
      expect(chat[key]).toBeGreaterThanOrEqual(next[key])
      if (chat[key] === next[key]) expect(chat.id).toBeLessThan(next.id)
    }
  }
)
