// Toggle group: ui-sdk's toggle group (one shared value, arrow keys
// between its toggles, aria-pressed) drawn as the Library's view switch:
// icon toggles on a muted track, the pressed one on the secondary fill in
// full ink, the way the tabs mark theirs. Give the group and each toggle
// an accessible name; ToggleIcon hides its icon from screen readers.
// PillToggle is a toggle on its own, as Grok's header pill: a 32px ghost
// pill, an 18px glyph then its words, muted until pressed, when it fills
// with the quiet wash in full ink, as Grok's Private does. Its name stays
// the same pressed or not, as ui-sdk asks, so a screen reader announces
// the state instead.
import type * as React from "react"
import {
  Toggle as TogglePrimitive,
  ToggleGroup as ToggleGroupPrimitive,
  ToggleIcon,
} from "@ui-sdk/react/toggle"

import { buttonVariants } from "@/components/ui/button"
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

function PillToggle({
  className,
  ...props
}: React.ComponentProps<typeof TogglePrimitive>) {
  return (
    <TogglePrimitive
      data-slot="pill-toggle"
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "gap-1.5 px-3 text-base font-normal data-pressed:bg-secondary data-pressed:text-foreground data-pressed:hover:bg-secondary-hover [&_svg:not([class*='size-'])]:size-4.5",
        className
      )}
      {...props}
    />
  )
}

export { PillToggle, Toggle, ToggleGroup, ToggleIcon }
