// The sidebar's groups: Pinned first, then Today, Yesterday, Previous 7
// days and Older, by the calendar day of a chat's last activity (or, when
// the Chats header's … sorts by Date created, of its start) in the
// browser's own time zone, newest first. A pinned chat shows only under
// Pinned. The list arrives sorted by last activity (src/lib/chat/store.ts);
// sortChats re-sorts it by creation, keeping the pins first.

/** The groups that start at a midnight, in the order of `starts` below. */
const DAYS = ["Today", "Yesterday", "Previous 7 days"] as const

const GROUPS = ["Pinned", ...DAYS, "Older"] as const

type Group = (typeof GROUPS)[number]

/** Local midnight `days` days before `now`'s day. */
function midnight(now: number, days: number): number {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() - days)
  return day.getTime()
}

/** What the list is sorted and grouped by: last activity or creation. */
export const CHAT_SORTS = ["updatedAt", "createdAt"] as const

export type ChatSort = (typeof CHAT_SORTS)[number]

export const isChatSort = (value: unknown): value is ChatSort =>
  CHAT_SORTS.some((sort) => sort === value)

type Dated = { pinned: boolean; updatedAt: number; createdAt: number }

/** Pins first, then newest first by `by`; ties keep the list's order. */
export function sortChats<T extends Dated>(
  chats: readonly T[],
  by: ChatSort
): T[] {
  return chats.toSorted(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b[by] - a[by]
  )
}

/** The chats in their groups, in order, leaving out empty groups. */
export function groupChats<T extends Dated>(
  chats: readonly T[],
  now: number,
  by: ChatSort = "updatedAt"
): { label: Group; chats: T[] }[] {
  const starts = [midnight(now, 0), midnight(now, 1), midnight(now, 7)]
  const groupOf = (chat: T): Group =>
    chat.pinned
      ? "Pinned"
      : (DAYS[starts.findIndex((start) => chat[by] >= start)] ?? "Older")
  return GROUPS.map((label) => ({
    label,
    chats: chats.filter((chat) => groupOf(chat) === label),
  })).filter((group) => group.chats.length > 0)
}
