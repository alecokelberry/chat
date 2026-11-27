// Settings' sections and the settings each holds, by name, for the nav and
// its search (src/components/chat/settings.tsx). Search keeps a section
// when its name or one of its settings' names holds what was typed,
// ignoring case and the spaces around it, in the order listed here. A new
// section or setting adds itself here.

export type SectionId = "account" | "appearance" | "customize" | "usage"

export type Section = {
  id: SectionId
  label: string
  /** The names of the settings and actions on its page. */
  settings: readonly string[]
}

export const SECTIONS: readonly Section[] = [
  {
    id: "account",
    label: "Account",
    settings: ["Name", "Email", "Sign out"],
  },
  {
    id: "appearance",
    label: "Appearance",
    settings: ["Theme", "Dark theme", "Wrap long code blocks"],
  },
  {
    id: "customize",
    label: "Customize",
    settings: [
      "Response style",
      "Custom instructions",
      "Concise",
      "Formal",
      "Tutor",
      "Comprehensive",
    ],
  },
  {
    id: "usage",
    label: "Usage",
    settings: ["Tokens", "Replies", "Models"],
  },
]

/** The sections whose name or settings hold `query`. */
export function findSections(query: string): readonly Section[] {
  const words = query.trim().toLocaleLowerCase()
  if (words === "") return SECTIONS
  const holds = (name: string) => name.toLocaleLowerCase().includes(words)
  return SECTIONS.filter(
    (section) => holds(section.label) || section.settings.some(holds)
  )
}

/** Whether `value` names a section. */
export const isSectionId = (value: unknown): value is SectionId =>
  SECTIONS.some((section) => section.id === value)
