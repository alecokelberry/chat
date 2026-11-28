// Trigger menu: ui-sdk's TriggerMenu (it opens at the caret as a trigger
// like `/` is typed, narrows as more is typed, and keeps focus in the text
// field while the arrows move the highlight) with the look of Menu's and
// Select's lists: a 256px popover with 20px corners, 8px in, a hairline and
// two soft drops, 6px from its anchor. Rows are 32px with 12px corners.
// It is only a popover, never a sheet: the keyboard is up while typing, and
// the list sits above the composer, where it can't be under a thumb.
import type * as React from "react"
import {
  TriggerMenuContent as TriggerMenuContentPrimitive,
  TriggerMenuEmpty as TriggerMenuEmptyPrimitive,
  TriggerMenuItem as TriggerMenuItemPrimitive,
} from "@ui-sdk/react/trigger-menu"

import { cn } from "@/lib/utils"

function TriggerMenuContent({
  className,
  side = "top",
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TriggerMenuContentPrimitive>) {
  return (
    <TriggerMenuContentPrimitive
      side={side}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "fixed max-h-(--available-height) w-64 popup-motion overflow-x-hidden overflow-y-auto overscroll-contain rounded-overlay border border-border-strong bg-popover p-2 text-popover-foreground shadow-popover outline-hidden",
        className
      )}
      {...props}
    />
  )
}

function TriggerMenuItem<T>({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuItemPrimitive<T>>) {
  return (
    <TriggerMenuItemPrimitive<T>
      className={cn(
        "relative flex min-h-8 items-center gap-1.5 rounded-item px-2 py-0.75 text-sm outline-hidden select-none active:bg-accent active:text-accent-foreground data-disabled:opacity-50 highlighted:bg-accent highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TriggerMenuEmpty({
  className,
  ...props
}: React.ComponentProps<typeof TriggerMenuEmptyPrimitive>) {
  return (
    <TriggerMenuEmptyPrimitive
      className={cn(
        "hidden px-2 py-1.5 text-sm text-muted-foreground data-empty:block",
        className
      )}
      {...props}
    />
  )
}

export { TriggerMenuContent, TriggerMenuEmpty, TriggerMenuItem }
export {
  TriggerMenu,
  TriggerMenuList,
  TriggerMenuStatus,
  textFieldAdapter,
  type TextEditorAdapter,
} from "@ui-sdk/react/trigger-menu"
