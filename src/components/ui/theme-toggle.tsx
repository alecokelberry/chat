// The light/dark switch for pages with no account menu (sign-in, setup):
// a 32px ghost circle with the spinning sun and moon (theme-icon.tsx). A
// ui-sdk Toggle, pressed while dark shows; its name is the same in both
// states, as ui-sdk asks, so screen readers announce the pressed state.
// The icons swap by CSS, so nothing flashes before the page's scripts run;
// only aria-pressed waits for them.
import { Toggle } from "@ui-sdk/react/toggle"

import { buttonVariants } from "@/components/ui/button"
import { useIsDark, useToggleTheme } from "@/components/ui/preferences"
import { ThemeIcon } from "@/components/ui/theme-icon"

function ThemeToggle() {
  const dark = useIsDark()
  const toggle = useToggleTheme()
  return (
    <Toggle
      aria-label="Dark theme"
      pressed={dark}
      onPressedChange={toggle}
      className={buttonVariants({
        variant: "ghost",
        size: "circle",
        className: "[&_svg]:size-5",
      })}
    >
      <ThemeIcon />
    </Toggle>
  )
}

export { ThemeToggle }
