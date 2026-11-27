// A person's initials for their avatar: the first word's first letter and
// the last word's, upper-cased ("Alec Okelberry" is AO, "Dev" is D). A
// letter outside the BMP (𝒜) is kept whole, never split in half, and one
// whose capital is longer (ﬀ is FF) gives the capital's first letter.

/** Up to two initials: the first word's and the last's. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = (word: string | undefined) =>
    Array.from(Array.from(word ?? "")[0]?.toLocaleUpperCase() ?? "")[0] ?? ""
  return words.length > 1
    ? first(words[0]) + first(words.at(-1))
    : first(words[0])
}
