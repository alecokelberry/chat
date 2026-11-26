// Saved choices: ui-sdk's Preferences, kept in this browser's localStorage
// and put on <html> as a data attribute. For now, the one choice is the
// color scheme (data-color-scheme: system, light or dark), which app.css's
// dark variant follows; the account menu's Theme flips it. <AppPreferences>
// sits at the top of <body>; on the server it renders an inline script
// that sets the attributes before the first paint, so CSS that selects
// them is right from the start, with nothing to flash.
// The status bar's theme-color follows the choice once the page's
// scripts run; until then it follows the system, as in the archived Chat.
import * as React from "react"
// oxlint-disable-next-line no-restricted-imports -- preferences and storage have no entry of their own
import { createColorScheme, createLocalStorage } from "@ui-sdk/core"
import { Preferences, usePreference } from "@ui-sdk/react/preferences"

/** The status bar's color, light and dark: the page's --background in
 *  app.css, repeated here because the server writes it into the head. */
const THEME_COLOR = { light: "#f9f8f7", dark: "#1e1d1d" } as const

const colorScheme = createColorScheme({
  storage: createLocalStorage("theme"),
  global: true,
})

function AppPreferences({ children }: { children: React.ReactNode }) {
  return (
    <Preferences preferences={[colorScheme]}>
      <StatusBarColor />
      {children}
    </Preferences>
  )
}

/** The theme-color metas (src/routes/__root.tsx) follow the system; a
 *  Light or Dark choice points both at its color. */
function StatusBarColor() {
  const { value } = usePreference(colorScheme)
  React.useEffect(() => {
    const metas = document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )
    for (const meta of metas) {
      const own = meta.media.includes("dark") ? "dark" : "light"
      meta.content = THEME_COLOR[value === "system" ? own : value]
    }
  }, [value])
  return null
}

/** Flips light and dark, from whichever is showing. */
function useToggleTheme() {
  const { resolved } = usePreference(colorScheme)
  return () => colorScheme.set(resolved === "dark" ? "light" : "dark")
}

export { AppPreferences, THEME_COLOR, useToggleTheme }
