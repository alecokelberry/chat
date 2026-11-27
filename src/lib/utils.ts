// cn: joins class names and merges Tailwind conflicts, with the design
// system's own tokens (src/styles/app.css) registered so they merge like
// built-ins. A new token name goes here too.
import { createCn } from "cn/config"

export const cn = createCn({
  extend: {
    theme: {
      spacing: [
        "icon",
        "sidebar",
        "sidebar-rail",
        "sidebar-header",
        "list-overlap",
        "draft",
        "draft-inline",
        "header",
        "header-content",
        "dialog-top",
        "dialog-list",
        "dialog-height",
      ],
      radius: ["item", "overlay", "composer"],
      container: ["composer", "signin", "dialog", "dialog-wide"],
      ease: ["standard", "decelerate", "spring", "out-quint"],
    },
    classGroups: {
      duration: [
        {
          duration: ["fast", "base", "menu", "pane", "spin", "sidebar"],
        },
      ],
    },
  },
})

/** A tab's title: the page's name, then the app's. */
export const pageTitle = (name: string) => `${name} – Chat`
