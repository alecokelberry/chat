import { fc, it } from "@fast-check/vitest"
import { expect, test } from "vitest"

import { relativeTime } from "@/lib/chat/relative-time"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const now = Date.UTC(2026, 10, 27, 12)

test("says how long ago, in Grok's short form", () => {
  expect(relativeTime(now - 10_000, now)).toBe("now")
  expect(relativeTime(now - 5 * MINUTE, now)).toBe("5m")
  expect(relativeTime(now - 3 * HOUR, now)).toBe("3h")
  expect(relativeTime(now - DAY, now)).toBe("1d")
  expect(relativeTime(now - 2 * DAY - HOUR, now)).toBe("2d")
  expect(relativeTime(now - 9 * DAY, now)).toBe("1w")
  expect(relativeTime(now - 40 * DAY, now)).toBe("1mo")
  expect(relativeTime(now - 400 * DAY, now)).toBe("1y")
})

test("a time ahead of the clock reads as now", () => {
  expect(relativeTime(now + HOUR, now)).toBe("now")
})

it.prop([
  fc.integer({ min: 0, max: 20 * 365 * DAY }),
  fc.integer({ min: 0, max: 20 * 365 * DAY }),
])("never says longer ago for a later time", (a, b) => {
  const order = ["now", "m", "h", "d", "w", "mo", "y"]
  const rank = (text: string) => {
    const unit = text.replace(/^\d+/, "")
    return [order.indexOf(unit), Number.parseInt(text, 10) || 0] as const
  }
  const [early, late] = a < b ? [a, b] : [b, a]
  const [u1, n1] = rank(relativeTime(now - late, now))
  const [u2, n2] = rank(relativeTime(now - early, now))
  expect(u1 > u2 || (u1 === u2 && n1 >= n2)).toBe(true)
})
