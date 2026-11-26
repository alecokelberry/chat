// Select: ui-sdk's select (keyboard, typeahead, focus and ARIA) with the
// look of the archived Chat's menus, Grok's. The trigger is a 32px pill in
// full ink whose chevron turns up while open; the list is a 240px popover
// with 20px corners, 8px in, a hairline and two soft drops, that fades and
// zooms in from the trigger (popup-motion), 4px away. Rows are 32px with
// 12px corners and a muted check on the chosen one. On a phone it's a
// sheet from the bottom instead (presentation "auto"), with 48px rows and
// padding clear of the home indicator. The sheet moves only by ui-sdk's
// own translate: no fade, zoom, blur or shadow of ours runs while it
// slides, so it stays on the compositor. As a popover it's `fixed` from
// the first frame, since popups render in place and Safari painted one
// inside the composer's row for a few frames.
import type * as React from "react"
import {
  Select as SelectPrimitive,
  SelectContent as SelectContentPrimitive,
  SelectItem as SelectItemPrimitive,
  SelectItemIndicator,
  SelectTrigger as SelectTriggerPrimitive,
} from "@ui-sdk/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Select<T>(props: React.ComponentProps<typeof SelectPrimitive<T>>) {
  return <SelectPrimitive<T> presentation="auto" {...props} />
}

function SelectTrigger({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SelectTriggerPrimitive>, "children"> & {
  children?: React.ReactNode
}) {
  return (
    <SelectTriggerPrimitive
      className={cn(
        "group/select relative inline-flex h-8 shrink-0 press items-center gap-1 rounded-full ps-3 pe-2.5 text-base font-medium whitespace-nowrap text-foreground outline-hidden select-none after:absolute after:-inset-1 hover:bg-secondary-hover focus-visible:ring-2 focus-visible:ring-ring active:bg-secondary-active data-open:bg-secondary-hover",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-fast ease-standard group-data-open/select:rotate-180"
      />
    </SelectTriggerPrimitive>
  )
}

function SelectContent({
  className,
  align = "end",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof SelectContentPrimitive>) {
  return (
    <SelectContentPrimitive
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "overflow-x-hidden overflow-y-auto overscroll-contain border border-border-strong bg-popover p-2 text-popover-foreground outline-hidden",
        "data-[presentation=popover]:fixed data-[presentation=popover]:max-h-(--available-height) data-[presentation=popover]:w-60 data-[presentation=popover]:popup-motion data-[presentation=popover]:rounded-overlay data-[presentation=popover]:shadow-popover",
        "data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-t-overlay data-[presentation=sheet]:border-b-0 data-[presentation=sheet]:pt-3 data-[presentation=sheet]:safe-area-bottom",
        className
      )}
      {...props}
    />
  )
}

function SelectItem<T>({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SelectItemPrimitive<T>>, "children"> & {
  children?: React.ReactNode
}) {
  return (
    <SelectItemPrimitive<T>
      className={cn(
        "relative flex min-h-8 items-center rounded-xl py-0.75 ps-2 pe-8 text-sm outline-hidden select-none active:bg-accent active:text-accent-foreground in-data-[presentation=sheet]:min-h-12 in-data-[presentation=sheet]:ps-3 in-data-[presentation=sheet]:text-base highlighted:bg-accent highlighted:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
      <SelectItemIndicator className="pointer-events-none absolute end-2 flex items-center text-muted-foreground [&_svg]:size-4">
        <CheckIcon aria-hidden="true" />
      </SelectItemIndicator>
    </SelectItemPrimitive>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger }
export { SelectValue } from "@ui-sdk/react/select"
