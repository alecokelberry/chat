// Where Tab goes in the ⌘K palette (src/components/chat/search-chats.tsx):
// to the first row of the next section that has rows (Shift+Tab, the one
// before), wrapping around. With no row highlighted, Tab starts at the
// first section and Shift+Tab at the last.

/** The value Tab (step 1) or Shift+Tab (step -1) highlights, given each
 *  section's row values in order and the highlighted one. */
export function nextSection(
  sections: readonly (readonly string[])[],
  value: string | null,
  step: 1 | -1
): string | undefined {
  const filled = sections.filter((section) => section.length > 0)
  if (filled.length === 0) return undefined
  const at = filled.findIndex(
    (section) => value !== null && section.includes(value)
  )
  const next =
    at === -1
      ? step === 1
        ? 0
        : filled.length - 1
      : (at + step + filled.length) % filled.length
  return filled[next]?.[0]
}
