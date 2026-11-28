// Toggle group: ui-sdk's toggle group (one shared value, arrow keys
// between its toggles, aria-pressed) drawn as the Library's view switch:
// icon toggles on a muted track, the pressed one on the secondary fill in
// full ink, the way the tabs mark theirs. Give the group and each toggle
// an accessible name; ToggleIcon hides its icon from screen readers.
import type * as React from "react"
import {
  Toggle as TogglePrimitive,
  ToggleGroup as ToggleGroupPrimitive,
  ToggleIcon,
} from "@ui-sdk/react/toggle"

import { cn } from "@/lib/utils"

function ToggleGroup<T extends string>({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive<T>>) {
  return (
    <ToggleGroupPrimitive<T>
      data-slot="toggle-group"
      className={cn(
        "flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5",
        className
      )}
      {...props}
    />
  )
}

function Toggle({
  className,
  ...props
}: React.ComponentProps<typeof TogglePrimitive>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(
        "flex size-7 press items-center justify-center rounded-md text-muted-foreground outline-hidden select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-pressed:bg-secondary data-pressed:text-foreground [&_svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

export { Toggle, ToggleGroup, ToggleIcon }
