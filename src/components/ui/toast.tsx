// Toasts: ui-sdk's OverlayHost, mounted once by the root document, renders
// what toast() shows from anywhere. The archived Chat's look: always dark
// (a .dark scope), 356px, 24px in from the bottom right; on a phone at the
// top, 12px down like iOS's banners, clear of the composer, and swiped up
// to go. A toast is --toast with a hairline ring, 12px corners, a 12px
// title and a light action button (Undo). No close button: toasts time
// out or swipe away. The stack's motion is `toast-stack` in app.css.
// App code shows one with `toast()` from here.
//
// The region is hidden from agents (it drops its name while empty). Test
// builds put toast() on window, so e2e can show one before a feature does.
import { OverlayHost } from "@ui-sdk/react/overlays"
import {
  Toast,
  ToastAction,
  ToastDescription,
  ToastTitle,
  toast,
} from "@ui-sdk/react/toast"

import { usePhone } from "@/lib/media"

if (import.meta.env.MODE === "test" && typeof window !== "undefined") {
  Object.assign(window, { toast })
}

// OverlayHost's types list only ToastRegion's own props; the region still
// puts any other attribute on its element.
const hiddenFromAgents = { "data-agent-hidden": "" }

function Toasts() {
  const phone = usePhone()
  return (
    <OverlayHost
      toast={{
        side: phone === true ? "top" : "bottom",
        align: "end",
        className: "dark toast-region outline-hidden",
        ...hiddenFromAgents,
        children: (item) => (
          <Toast className="toast-stack rounded-xl bg-toast text-foreground shadow-elevated ring-1 ring-border outline-hidden ring-inset focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <ToastTitle className="text-xs font-medium" />
                <ToastDescription className="text-sm text-ink-secondary" />
              </div>
              {item.action !== undefined && (
                <ToastAction className="ms-5 shrink-0 press rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground outline-hidden hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring active:bg-primary-active" />
              )}
            </div>
          </Toast>
        ),
      }}
    />
  )
}

export { Toasts, toast }
