// The document every page renders into: fonts, tokens, and the color
// scheme following the system (a theme toggle comes with the shell). The
// page tracks whether focus came from the keyboard (FocusModality). The
// head also makes it installable: public/manifest.webmanifest names the app
// and its icons, iOS reads the apple-touch-icon, and theme-color paints the
// status bar in the page's background, light or dark (--background). The
// theme toggle will need to set theme-color too: the media queries only
// follow the system.
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import "@/components/ui/dev-agent"

import type { ReactNode } from "react"
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"

import { FocusModality } from "@/components/ui/focus-modality"

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
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-color-scheme="system">
      <head>
        <HeadContent />
        {/* Here, not in head(): HeadContent keeps one meta per name. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#f9f8f7"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#1e1d1d"
        />
      </head>
      <body>
        {children}
        <FocusModality />
        <Scripts />
      </body>
    </html>
  )
}
