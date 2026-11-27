// shortcutKeys: a shortcut hint as ui-sdk formats it for the platform
// ("⌘K" on a Mac, "Ctrl+K" elsewhere, wrapped in a left-to-right
// isolate) split into one key per keycap: ["⌘", "K"], ["Ctrl", "K"].
// ui-sdk stays the one place that decides the platform and the symbols.

/** The modifier symbols a Mac hint leads with, one keycap each. */
const MAC_MODIFIERS = /^[⌘⇧⌥⌃]/u

export function shortcutKeys(hint: string): string[] {
  const text = hint.replace(/[\u2066-\u2069]/gu, "")
  if (text === "") return []
  // Elsewhere: "Ctrl+Shift+K".
  if (text.includes("+")) return text.split("+")
  const keys: string[] = []
  let rest = text
  while (rest.length > 1 && MAC_MODIFIERS.test(rest)) {
    keys.push(rest.slice(0, 1))
    rest = rest.slice(1)
  }
  return [...keys, rest]
}
