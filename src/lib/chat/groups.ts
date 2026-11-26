// The sidebar's groups: Today, Yesterday, Previous 7 days and Older, by
// the calendar day of a chat's last activity in the browser's own time
// zone, newest first. The list arrives sorted (src/lib/chat/store.ts).

const GROUPS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const

type Group = (typeof GROUPS)[number]

/** Local midnight `days` days before `now`'s day. */
function midnight(now: number, days: number): number {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() - days)
  return day.getTime()
}

/** The chats in their groups, in order, leaving out empty groups. */
export function groupChats<T extends { updatedAt: number }>(
  chats: readonly T[],
  now: number
): { label: Group; chats: T[] }[] {
  const starts = [midnight(now, 0), midnight(now, 1), midnight(now, 7)]
  const groupOf = (at: number): Group =>
    GROUPS[starts.findIndex((start) => at >= start)] ?? "Older"
  return GROUPS.map((label) => ({
    label,
    chats: chats.filter((chat) => groupOf(chat.updatedAt) === label),
  })).filter((group) => group.chats.length > 0)
}
