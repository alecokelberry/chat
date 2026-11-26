// Menu: ui-sdk's menu (focus, arrow keys, typeahead, dismissal, pending
// items) with the look of the archived Chat's menus, Grok's, like Select's
// list: a 256px popover with 20px corners, 8px in, a hairline and two soft
// drops, that fades and zooms in from its trigger (popup-motion), 6px
// away. Rows are 32px with 12px corners and 16px muted icons; a pending
// row dims, and a destructive one (Delete) is red. On a phone it's a
// sheet from the bottom instead (presentation "auto", DESIGN.md ›
// Phones), with 48px rows and padding clear of the home indicator, moved only by ui-sdk's own translate. As a popover it's
// `fixed` from the first frame, since popups render in place and Safari
// painted one inside its trigger's row for a few frames.
import type * as React from "react"
import {
  Menu as MenuPrimitive,
  MenuContent as MenuContentPrimitive,
  MenuGroup,
  MenuGroupLabel as MenuGroupLabelPrimitive,
  MenuItem as MenuItemPrimitive,
  MenuSeparator as MenuSeparatorPrimitive,
  MenuTrigger,
} from "@ui-sdk/react/menu"

import { cn } from "@/lib/utils"

function Menu(props: React.ComponentProps<typeof MenuPrimitive>) {
  return <MenuPrimitive presentation="auto" {...props} />
}

function MenuContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof MenuContentPrimitive>) {
  return (
    <MenuContentPrimitive
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "overflow-x-hidden overflow-y-auto overscroll-contain border border-border-strong bg-popover p-2 text-popover-foreground outline-hidden",
        "data-[presentation=popover]:fixed data-[presentation=popover]:max-h-(--available-height) data-[presentation=popover]:w-64 data-[presentation=popover]:popup-motion data-[presentation=popover]:rounded-overlay data-[presentation=popover]:shadow-popover",
        "data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-t-overlay data-[presentation=sheet]:border-b-0 data-[presentation=sheet]:pt-3 data-[presentation=sheet]:safe-area-bottom",
        className
      )}
      {...props}
    />
  )
}

function MenuItem({
  className,
  ...props
}: React.ComponentProps<typeof MenuItemPrimitive>) {
  return (
    <MenuItemPrimitive
      className={cn(
        "relative flex min-h-8 items-center gap-3.5 rounded-xl px-2 py-0.75 text-sm outline-hidden select-none active:bg-accent active:text-accent-foreground in-data-[presentation=sheet]:min-h-12 in-data-[presentation=sheet]:px-3 in-data-[presentation=sheet]:text-base data-destructive:text-destructive-foreground data-destructive:active:bg-destructive/10 data-destructive:active:text-destructive-foreground data-disabled:opacity-50 data-pending:opacity-50 highlighted:bg-accent highlighted:text-accent-foreground data-destructive:highlighted:bg-destructive/10 data-destructive:highlighted:text-destructive-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-destructive:[&_svg]:text-destructive-foreground",
        className
      )}
      {...props}
    />
  )
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuSeparatorPrimitive>) {
  return (
    <MenuSeparatorPrimitive
      className={cn("-mx-2 my-1.5 h-px bg-border", className)}
      {...props}
    />
  )
}

/** A group's heading, or a header like the account menu's name and email:
 *  8px in, 14/20 medium in full ink, a second line in muted 12px. */
function MenuGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuGroupLabelPrimitive>) {
  return (
    <MenuGroupLabelPrimitive
      className={cn(
        "flex flex-col px-2 py-1.5 text-sm font-medium text-foreground select-text [&_small]:text-xs [&_small]:font-normal [&_small]:wrap-anywhere [&_small]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
}
