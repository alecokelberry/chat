// The document every page renders into: fonts, tokens, and the saved
// color scheme (AppPreferences, which puts it on <html> before the first
// paint, so <html> expects its attribute to change). The
// page tracks whether focus came from the keyboard (FocusModality), shows
// a press the moment a finger lands (PressFeedback), and holds the one
// toast area (Toasts). The
// head also makes it installable: public/manifest.webmanifest names the app
// and its icons, iOS reads the apple-touch-icon, and theme-color paints the
// status bar in the page's background, light or dark, following the
// theme the account menu picks: the server writes the saved one from its
// cookie (src/lib/theme.ts), since an iPhone's Home Screen app reads the
// tag once, as the page loads.
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import "@/components/ui/dev-agent"

import type { ReactNode } from "react"
import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"

import { FocusModality } from "@/components/ui/focus-modality"
import {
  AppPreferences,
  THEME_COLOR,
  THEME_COLOR_SCRIPT,
} from "@/components/ui/preferences"
import { PressFeedback } from "@/components/ui/press-feedback"
import { Toasts } from "@/components/ui/toast"
import { RELOAD_TRANSITION_SCRIPT } from "@/lib/reload-for-status-bar"
import { savedTheme } from "@/lib/theme"

import appCss from "@/styles/app.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "color-scheme", content: "light dark" },
      { title: "Chat" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  loader: () => ({ theme: savedTheme() }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  const { theme } = Route.useLoaderData()
  // A saved Light or Dark points both tags at its color; System leaves
  // each on its own.
  const color = (own: "light" | "dark") =>
    THEME_COLOR[theme === "system" ? own : theme]
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Here, not in head(): HeadContent keeps one meta per name. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={color("light")}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={color("dark")}
        />
        <ScriptOnce>{THEME_COLOR_SCRIPT}</ScriptOnce>
        <ScriptOnce>{RELOAD_TRANSITION_SCRIPT}</ScriptOnce>
      </head>
      <body>
        <AppPreferences>{children}</AppPreferences>
        <FocusModality />
        <PressFeedback />
        <Toasts />
        <Scripts />
      </body>
    </html>
  )
}
