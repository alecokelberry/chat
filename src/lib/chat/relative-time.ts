// relativeTime: how long ago something happened, in Grok's short form for
// Search's chat rows: "now", "5m", "3h", "2d", "1w", "4mo", "1y", each
// rounded down. Intl.RelativeTimeFormat's narrowest style still says
// "2d ago", so this is the few lines it takes instead.

const UNITS = [
  ["y", 365 * 86_400_000],
  ["mo", 30 * 86_400_000],
  ["w", 7 * 86_400_000],
  ["d", 86_400_000],
  ["h", 3_600_000],
  ["m", 60_000],
] as const

export function relativeTime(then: number, now: number): string {
  const ago = now - then
  for (const [unit, size] of UNITS) {
    if (ago >= size) return `${Math.floor(ago / size)}${unit}`
  }
  return "now"
}
