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
        "sidebar-header",
        "header",
        "header-content",
      ],
      radius: ["item", "overlay", "composer"],
      container: ["content", "composer", "signin"],
      ease: [
        "standard",
        "decelerate",
        "accelerate",
        "spring",
        "drawer",
        "out-quint",
      ],
    },
    classGroups: {
      duration: [
        {
          duration: [
            "fast",
            "base",
            "menu",
            "pane",
            "spin",
            "sidebar",
            "drawer",
          ],
        },
      ],
    },
  },
})
